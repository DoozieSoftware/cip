<?php

declare(strict_types=1);

namespace App\Modules\AI\Jobs;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Exceptions\AiEvidenceNotReadyException;
use App\Modules\AI\Exceptions\InvalidAiResponseException;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\Services\AiMediaReferenceResolver;
use App\Modules\AI\Services\AiResponseValidator;
use App\Modules\AI\Services\DuplicateDetector;
use App\Modules\AI\Services\FraudScorer;
use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\AI\Services\PiiMaskingService;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * The vision pipeline orchestrator (per docs/10 §8).
 *
 * One job instance per report. The constructor takes
 * just the report_id (UUID) to keep the serialised
 * payload small and the queue contract explicit.
 *
 * Pipeline (sequential, all in one job):
 *   1. resolve the report + its first media asset
 *   2. write an `ai_jobs` row in `running` state
 *   3. image quality (ImageQualityAnalyzer)
 *   4. OCR (not yet wired — passes empty string to PII masker)
 *   5. mask PII out of the free text before it ever reaches a
 *      third-party provider (PiiMaskingService, per docs/11 §28)
 *   6. vision classification (ProviderFailoverService) — skipped
 *      when the `ai_enabled` app_config flag is off, in which case
 *      a zero-confidence "unclassified" result is synthesised so
 *      the report still falls through to moderator review (see
 *      ConfidenceAggregator in AiCompletedListener)
 *   7. duplicate score (DuplicateDetector)
 *   8. fraud score (FraudScorer)
 *   9. write `ai_results` + `ai_labels`
 *  10. validate the result (AiResponseValidator) — skipped when
 *      AI was disabled, since there is nothing to validate
 *  11. mark the job as `succeeded` (recording the real
 *      provider/model that answered) and dispatch `AiCompleted`
 *      (the M7 routing listener picks it up from here)
 *
 * On any unrecoverable failure: mark the job as
 * `failed` with `error_code`, log the exception, and
 * rethrow so the queue worker records the failure.
 */
class AiPipelineOrchestrator implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 40;

    /** @var list<int> */
    public array $backoff = [5, 10, 20, 40, 80, 160, 300, 300, 300, 300];

    public int $timeout = 120;

    /** @var AiJob|null the row created at the start of a successful attempt */
    private ?AiJob $jobRow = null;

    public function __construct(public readonly string $reportId) {}

    public function handle(
        ProviderFailoverService $failover,
        AiResponseValidator $validator,
        ImageQualityAnalyzer $quality,
        DuplicateDetector $duplicate,
        FraudScorer $fraud,
        PiiMaskingService $pii,
        FeatureFlagService $flags,
        AiMediaReferenceResolver $mediaReferences,
    ): void {
        $this->jobRow = null;

        try {
            $report = Report::query()->findOrFail($this->reportId);
            $media = Media::query()
                ->where('report_id', $this->reportId)
                ->where('type', 'PHOTO')
                ->first()
                ?? Media::query()
                    ->where('report_id', $this->reportId)
                    ->where('type', 'VIDEO')
                    ->first();

            // Report creation and evidence upload are separate API calls. A
            // fast queue worker may receive this job before the photo request
            // completes. ReportMediaUploaded re-dispatches this job the moment
            // the asset lands, but we also retry on a long backoff here so a
            // late or out-of-order upload still reaches the pipeline instead
            // of being marked failed after a few seconds.
            if ($media === null) {
                throw new AiEvidenceNotReadyException;
            }

            $this->jobRow = $this->createJobRow();

            $actor = $report->citizen;

            $qualityScore = $media ? $quality->score($media) : 0;
            $ocrText = ''; // OCR provider not yet wired.

            $maskedText = (string) $pii->mask([
                'text' => $report->title."\n".$report->description."\n".$ocrText,
            ])['text'];
            $maskedMetadata = $pii->mask([
                'ward' => null, // The M3 GeographySeeder already binds these
                'district' => null,
            ]);

            if ($media->type === 'VIDEO') {
                // The configured OpenAI-compatible provider accepts image_url
                // inputs, not raw MP4 data. Video-only reports must still
                // reach moderators instead of repeatedly failing as an
                // invalid image request.
                $response = $this->videoReviewResponse($qualityScore);
                $providerCode = 'video-review';
                $model = 'deterministic-video-routing';
            } elseif ($quality->shouldFlagForModerator($qualityScore)) {
                $response = $this->lowQualityResponse($qualityScore);
                $providerCode = 'quality-gate';
                $model = 'deterministic-image-quality';
            } else {
                $request = new AiRequest(
                    promptName: 'category_classifier',
                    mediaUrls: [$mediaReferences->resolve($media)],
                    mediaTypes: [$media->mime],
                    text: $maskedText,
                    metadata: $maskedMetadata,
                );
                [$response, $providerCode, $model] = $this->classify($request, $failover, $validator, $flags, $actor);
                $response = $this->guardAgainstClaimMismatch($response);
            }

            $duplicateResult = $flags->enabled('duplicate_detection', $actor)
                ? $duplicate->detect($report)
                : ['score' => 0, 'matched_report_id' => null, 'reason' => 'disabled'];

            $recentReports = $report->citizen_id === null
                ? 0
                : Report::query()
                    ->where('citizen_id', $report->citizen_id)
                    ->where('created_at', '>=', now()->subDay())
                    ->count();
            $repeatedUploaderRisk = min(1.0, max(0, $recentReports - 5) / 5);

            $fraudScore = $flags->enabled('fraud_detection', $actor)
                ? $fraud->score($report, [
                    // The citizen PWA's client-side mock-GPS heuristic, captured
                    // at submit time onto reports.mock_gps_score (ReportService::submit).
                    'mock_gps' => (float) ($report->mock_gps_score ?? 0.0),
                    'replay' => ((int) $duplicateResult['score']) / 100,
                    'ai_synth' => $response->syntheticScore ?? 0.0,
                    'repeated_device' => $repeatedUploaderRisk,
                ])
            : 0;

            // FraudScorer already folds the provider's synthetic-image signal
            // in via the `ai_synth` key (response->syntheticScore). The
            // provider's own `fraud_score` field is an unreliable aggregate
            // (the vision model frequently returns 100 for genuine images),
            // so we do NOT let it override the platform-computed score. Only
            // elevate when the model explicitly reports visual manipulation
            // through synthetic_score, which FraudScorer weights separately.
            if ($response->syntheticScore !== null && $response->syntheticScore >= 0.5) {
                $fraudScore = max($fraudScore, (int) round($response->syntheticScore * 100));
            }

            $effectiveQualityScore = $this->effectiveQualityScore($qualityScore, $response);
            $calibratedConfidence = min($response->confidence, $effectiveQualityScore / 100);

            $result = $this->writeResult(
                $this->jobRow,
                $response,
                $effectiveQualityScore,
                $duplicateResult['score'],
                $fraudScore,
                $calibratedConfidence,
            );
            $this->writeLabels($result, $response, $calibratedConfidence);

            // Mirror onto the reports row: QueueController's
            // duplicates()/fraud() endpoints and the review queue's
            // confidence filter/column all read reports.duplicate_score /
            // reports.fraud_score / reports.ai_confidence directly — the
            // ai_results row above is not queried by any of them.
            // ai_results.confidence is 0..1; reports.ai_confidence is the
            // 0..100 percentage the moderator UI displays/filters on.
            $report->duplicate_score = $duplicateResult['score'];
            $report->fraud_score = $fraudScore;
            $report->ai_confidence = $calibratedConfidence * 100;
            $report->save();

            $this->markJobSucceeded($this->jobRow, $response, $result, $providerCode, $model);

            AiCompleted::dispatch(
                $report->id,
                $response->predictedType,
                $response->severity,
                $response->primaryLabel() ?? $response->predictedType,
                $response->licensePlate,
                array_replace($response->toArray(), ['confidence' => $calibratedConfidence]),
            );
        } catch (InvalidAiResponseException $e) {
            if ($this->jobRow !== null) {
                $this->markJobFailed($this->jobRow, 'invalid_ai_response', $e);
            }

            throw $e;
        } catch (Throwable $e) {
            if ($this->jobRow !== null) {
                $this->markJobFailed($this->jobRow, 'pipeline_error', $e);
            }

            throw $e;
        }
    }

    /**
     * Laravel's queue worker calls this once the job has exhausted its
     * retries ($tries = 1, so immediately on the first failure). Without
     * this, a failed AI call (bad provider response, timeout, etc.)
     * leaves the report stuck in `ai_processing` forever — nothing else
     * ever moves it. This is the "AI failure routes to a human" safety
     * net the pipeline's docblock describes, which was never actually
     * wired: apply the `moderator_review` transition with the platform's
     * system actor so the report reaches the moderator queue instead.
     */
    public function failed(?Throwable $exception): void
    {
        $report = Report::query()->find($this->reportId);

        if ($report === null) {
            return;
        }

        // The job row is created only after the media check passes, so a
        // missing-evidence failure (or any pre-row throw) leaves $job null
        // and must not strand the report. Always attempt the human fallback
        // regardless of whether an ai_jobs row exists.
        if ($exception instanceof AiEvidenceNotReadyException) {
            Log::warning('AiPipelineOrchestrator: exhausted retries waiting for evidence', [
                'report_id' => $this->reportId,
            ]);
        } elseif ($this->jobRow !== null) {
            $this->markJobFailed($this->jobRow, 'pipeline_error', $exception ?? new RuntimeException('unknown'));
        }

        $systemActor = app(SystemUserService::class)->user();
        $workflow = app(WorkflowEngine::class);

        $decision = $workflow->evaluate($report, 'moderator_review', $systemActor);

        if ($decision->allowed) {
            $workflow->apply($report, $decision, $systemActor);
        } else {
            Log::error('AiPipelineOrchestrator: AI job failed and could not fall back to moderator_review', [
                'report_id' => $this->reportId,
                'reasons' => $decision->reasons,
                'exception' => $exception?->getMessage(),
            ]);
        }
    }

    /**
     * @return array{0: AiResponse, 1: string, 2: string}
     */
    private function classify(
        AiRequest $request,
        ProviderFailoverService $failover,
        AiResponseValidator $validator,
        FeatureFlagService $flags,
        ?User $actor,
    ): array {
        if (! $this->visionEnabled($flags, $actor)) {
            return [$this->disabledResponse(), 'disabled', 'n/a'];
        }

        $response = $failover->execute($request);
        $validator->validate($response);

        $providerCode = $failover->lastUsedProvider?->code ?? 'unknown';
        $model = $failover->lastUsedProvider?->model ?? 'unknown';

        return [$response, $providerCode, $model];
    }

    /**
     * The `ai_enabled` app_configs flag (docs/09 §18) is the Super
     * Admin kill-switch: when off, the pipeline skips the provider
     * call entirely and every report falls through to moderator
     * review via the zero-confidence result below and
     * ConfidenceAggregator's threshold in AiCompletedListener. The
     * flag is evaluated through FeatureFlagService so cohort /
     * rollout rules are honoured, not just the raw `enabled` column.
     */
    private function visionEnabled(FeatureFlagService $flags, ?User $actor): bool
    {
        return $flags->enabled('ai_enabled', $actor);
    }

    private function disabledResponse(): AiResponse
    {
        return new AiResponse(
            labels: [],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: 0,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'AI vision is disabled (app_configs.ai_enabled) — routed to moderator review.',
            raw: ['ai_disabled' => true],
        );
    }

    private function lowQualityResponse(int $qualityScore): AiResponse
    {
        return new AiResponse(
            labels: [[
                'label' => 'unclassified',
                'confidence' => 0.0,
                'is_primary' => true,
            ]],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: $qualityScore,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'Evidence quality is too low for reliable visual classification; manual review is required.',
            raw: ['quality_gate' => true],
        );
    }

    private function videoReviewResponse(int $qualityScore): AiResponse
    {
        return new AiResponse(
            labels: [[
                'label' => 'unclassified',
                'confidence' => 0.0,
                'is_primary' => true,
            ]],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: $qualityScore,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'Video evidence requires manual review because the configured vision provider accepts image inputs only.',
            raw: ['video_review' => true],
        );
    }

    /**
     * Do NOT destroy the AI's visual classification when the citizen
     * claim doesn't fully match what the image shows.
     *
     * Previous behaviour forced confidence to 0 and the category to
     * "unclassified" whenever the model set claim_matches_evidence
     * to false. This was wrong: a pothole photo where the citizen
     * mentions two-wheelers that aren't visible IS a pothole — the
     * AI just can't confirm every detail of the claim. Destroying
     * the classification threw away the valuable visual signal and
     * left the moderator with no AI recommendation.
     *
     * New behaviour: preserve the AI's visual classification (type,
     * confidence, department, severity) as-is. The claim-mismatch
     * metadata (claimMatchesEvidence=false, consistencyScore,
     * mismatchReason) is kept so the moderator can see WHY the
     * model flagged the inconsistency, but the visual result is
     * not altered.
     *
     * Additionally, override claim_matches_evidence based on
     * consistency_score: if consistency >= 70, the primary civic
     * issue matches (the model just can't verify secondary details
     * like hazard descriptions), so the claim is treated as matching.
     * This prevents the model's unreliable boolean from blocking
     * auto-routing when the actual classification is correct.
     */
    private function guardAgainstClaimMismatch(AiResponse $response): AiResponse
    {
        // The model's claim_matches_evidence boolean is unreliable —
        // it rejects valid reports over unverifiable hazard descriptions.
        // Use consistency_score as the source of truth instead: if the
        // primary issue matches (consistency >= 70), override to true.
        if ($response->consistencyScore !== null && $response->consistencyScore >= 70
            && $response->claimMatchesEvidence === false) {
            return $response->withClaimMatches(true);
        }

        return $response;
    }

    private function createJobRow(): AiJob
    {
        $promptVersion = PromptVersion::query()
            ->where('name', 'category_classifier')
            ->where('status', 'approved')
            ->orderByDesc('version')
            ->first();

        return AiJob::query()->create([
            'report_id' => $this->reportId,
            'prompt_version_id' => $promptVersion?->id ?? (string) Str::uuid(),
            // Which provider/model actually answers isn't known until
            // classify() returns; markJobSucceeded() overwrites these
            // with the real values.
            'provider_code' => 'pending',
            'model' => 'pending',
            'status' => AiJob::STATUS_RUNNING,
            'requested_at' => now(),
            'started_at' => now(),
            'retry_count' => 0,
        ]);
    }

    private function writeResult(
        AiJob $job,
        AiResponse $response,
        int $qualityScore,
        int $duplicateScore,
        int $fraudScore,
        float $calibratedConfidence,
    ): AiResult {
        return AiResult::query()->create([
            'job_id' => $job->id,
            'predicted_type' => $response->predictedType,
            'confidence' => $calibratedConfidence,
            'recommended_department' => $response->recommendedDepartment,
            'severity' => $response->severity,
            'quality_score' => $qualityScore,
            'duplicate_score' => $duplicateScore,
            'fraud_score' => $fraudScore,
            'summary' => $response->summary,
            'license_plate' => $response->licensePlate,
            'plate_confidence' => $response->plateConfidence,
            'claim_matches_evidence' => $response->claimMatchesEvidence,
            'consistency_score' => $response->consistencyScore,
            'mismatch_reason' => $response->mismatchReason,
            'synthetic_score' => $response->syntheticScore,
            'raw_response' => $response->raw,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<int, array{label: string, confidence: float, is_primary: bool}>  $labels
     */
    private function writeLabels(AiResult $result, AiResponse $response, float $calibratedConfidence): void
    {
        foreach ($response->labels as $l) {
            AiLabel::query()->create([
                'result_id' => $result->id,
                'label' => $l['label'],
                'confidence' => min($l['confidence'], $calibratedConfidence),
                'is_primary' => $l['is_primary'],
                'created_at' => now(),
            ]);
        }
    }

    private function effectiveQualityScore(int $localQualityScore, AiResponse $response): int
    {
        return $response->qualityScore > 0
            ? min($localQualityScore, $response->qualityScore)
            : $localQualityScore;
    }

    private function markJobSucceeded(
        AiJob $job,
        AiResponse $response,
        AiResult $result,
        string $providerCode,
        string $model,
    ): void {
        $startMs = (int) $job->started_at?->valueOf() ?? (int) (microtime(true) * 1000);
        $endMs = (int) (microtime(true) * 1000);

        $job->update([
            'status' => AiJob::STATUS_SUCCEEDED,
            'completed_at' => now(),
            'provider_code' => $providerCode,
            'model' => $model,
            'processing_time_ms' => max(0, $endMs - $startMs),
            'tokens_in' => isset($response->raw['usage']['prompt_tokens']) ? (int) $response->raw['usage']['prompt_tokens'] : null,
            'tokens_out' => isset($response->raw['usage']['completion_tokens']) ? (int) $response->raw['usage']['completion_tokens'] : null,
        ]);
    }

    private function markJobFailed(AiJob $job, string $code, Throwable $e): void
    {
        $job->update([
            'status' => AiJob::STATUS_FAILED,
            'completed_at' => now(),
            'error_code' => $code,
        ]);

        Log::error('ai.pipeline.failed', [
            'job_id' => $job->id,
            'code' => $code,
            'error' => $e->getMessage(),
        ]);
    }
}
