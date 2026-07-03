<?php

declare(strict_types=1);

namespace App\Modules\AI\Jobs;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Exceptions\InvalidAiResponseException;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\Services\AiResponseValidator;
use App\Modules\AI\Services\DuplicateDetector;
use App\Modules\AI\Services\FraudScorer;
use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\AI\Services\PiiMaskingService;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Models\AppConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public readonly string $reportId) {}

    public function handle(
        ProviderFailoverService $failover,
        AiResponseValidator $validator,
        ImageQualityAnalyzer $quality,
        DuplicateDetector $duplicate,
        FraudScorer $fraud,
        PiiMaskingService $pii,
    ): void {
        $job = $this->createJobRow();

        try {
            $report = Report::query()->findOrFail($this->reportId);
            $media = Media::query()->where('report_id', $this->reportId)->first();

            $qualityScore = $media ? $quality->score($media) : 0;
            $ocrText = ''; // OCR provider not yet wired.

            $maskedText = (string) $pii->mask([
                'text' => $report->title."\n".$report->description."\n".$ocrText,
            ])['text'];
            $maskedMetadata = $pii->mask([
                'ward' => null, // The M3 GeographySeeder already binds these
                'district' => null,
            ]);

            $request = new AiRequest(
                promptName: 'category_classifier',
                mediaUrls: $media ? [$this->mediaUrl($media)] : [],
                mediaTypes: $media ? [$media->mime] : [],
                text: $maskedText,
                metadata: $maskedMetadata,
            );

            [$response, $providerCode, $model] = $this->classify($request, $failover, $validator);

            $duplicateResult = $duplicate->detect($report);
            $fraudScore = $fraud->score($report, [
                // The citizen PWA's client-side mock-GPS heuristic, captured
                // at submit time onto reports.mock_gps_score (ReportService::submit).
                'mock_gps' => (float) ($report->mock_gps_score ?? 0.0),
                'replay' => 0.0,
                'ai_synth' => isset($response->raw['synthetic_score']) ? (float) $response->raw['synthetic_score'] : 0.0,
            ]);

            $result = $this->writeResult($job, $response, $qualityScore, $duplicateResult['score'], $fraudScore);
            $this->writeLabels($result, $response);

            $this->markJobSucceeded($job, $response, $result, $providerCode, $model);

            AiCompleted::dispatch(
                $report->id,
                $response->predictedType,
                $response->severity,
                $response->primaryLabel() ?? $response->predictedType,
                $response->toArray(),
            );
        } catch (InvalidAiResponseException $e) {
            $this->markJobFailed($job, 'invalid_ai_response', $e);

            throw $e;
        } catch (Throwable $e) {
            $this->markJobFailed($job, 'pipeline_error', $e);

            throw $e;
        }
    }

    /**
     * @return array{0: AiResponse, 1: string, 2: string}
     */
    private function classify(
        AiRequest $request,
        ProviderFailoverService $failover,
        AiResponseValidator $validator,
    ): array {
        if (! $this->visionEnabled()) {
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
     * ConfidenceAggregator's threshold in AiCompletedListener.
     */
    private function visionEnabled(): bool
    {
        $flag = AppConfig::query()->where('key', 'ai_enabled')->first();

        return $flag === null || $flag->enabled;
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

    private function mediaUrl(Media $media): string
    {
        // The AI provider (e.g. a Modal.com-hosted vLLM endpoint)
        // needs a publicly-reachable URL to fetch the photo.
        // MediaUrl::temporary() generates either an S3 presigned
        // URL (MinIO/production) or a Laravel signed route
        // (api.v1.media.serve) that the endpoint can fetch. The
        // signed route includes an expiry and signature so the
        // URL is self-authenticating — no auth header needed.
        return app(MediaUrl::class)->temporary($media);
    }

    private function writeResult(
        AiJob $job,
        AiResponse $response,
        int $qualityScore,
        int $duplicateScore,
        int $fraudScore,
    ): AiResult {
        return AiResult::query()->create([
            'job_id' => $job->id,
            'predicted_type' => $response->predictedType,
            'confidence' => $response->confidence,
            'recommended_department' => $response->recommendedDepartment,
            'severity' => $response->severity,
            'quality_score' => $qualityScore,
            'duplicate_score' => $duplicateScore,
            'fraud_score' => $fraudScore,
            'summary' => $response->summary,
            'raw_response' => $response->raw,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<int, array{label: string, confidence: float, is_primary: bool}>  $labels
     */
    private function writeLabels(AiResult $result, AiResponse $response): void
    {
        foreach ($response->labels as $l) {
            AiLabel::query()->create([
                'result_id' => $result->id,
                'label' => $l['label'],
                'confidence' => $l['confidence'],
                'is_primary' => $l['is_primary'],
                'created_at' => now(),
            ]);
        }
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
