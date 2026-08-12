<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\ValueObjects\AiAnalysisOutcome;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Reports\Models\Report;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

final class AiResultWriter
{
    public function hasSucceeded(string $reportId, string $revision): bool
    {
        return AiJob::query()
            ->where('report_id', $reportId)
            ->where('evidence_revision', $revision)
            ->where('status', AiJob::STATUS_SUCCEEDED)
            ->exists();
    }

    public function start(string $reportId, string $revision): AiJob
    {
        $promptVersion = PromptVersion::query()
            ->where('name', 'category_classifier')
            ->where('status', 'approved')
            ->orderByDesc('version')
            ->first();

        $job = AiJob::query()->firstOrCreate(
            [
                'report_id' => $reportId,
                'evidence_revision' => $revision,
            ],
            [
                'prompt_version_id' => $promptVersion->id ?? (string) Str::uuid(),
                'provider_code' => 'pending',
                'model' => 'pending',
                'status' => AiJob::STATUS_RUNNING,
                'requested_at' => now(),
                'started_at' => now(),
                'retry_count' => 0,
            ],
        );

        if ($job->status !== AiJob::STATUS_SUCCEEDED) {
            $job->forceFill([
                'status' => AiJob::STATUS_RUNNING,
                'started_at' => now(),
                'completed_at' => null,
                'error_code' => null,
            ])->save();
        }

        return $job;
    }

    public function complete(AiJob $job, Report $report, AiAnalysisOutcome $outcome): AiResult
    {
        $result = DB::transaction(function () use ($job, $report, $outcome): AiResult {
            $result = $this->writeResult($job, $outcome);
            $this->writeLabels($result, $outcome->response, $outcome->confidence);

            $report->ai_label = $outcome->response->primaryLabel() ?? $outcome->response->predictedType;
            $report->duplicate_score = $outcome->duplicateScore;
            $report->fraud_score = $outcome->fraudScore;
            $report->ai_confidence = $outcome->confidence * 100;
            $report->save();

            return $result;
        });

        $this->markSucceeded($job, $outcome);

        return $result;
    }

    public function fail(AiJob $job, string $code, Throwable $exception): void
    {
        $job->update([
            'status' => AiJob::STATUS_FAILED,
            'completed_at' => now(),
            'error_code' => $code,
        ]);

        Log::error('ai.pipeline.failed', [
            'job_id' => $job->id,
            'code' => $code,
            'error' => $exception->getMessage(),
        ]);
    }

    private function writeResult(AiJob $job, AiAnalysisOutcome $outcome): AiResult
    {
        $response = $outcome->response;

        return AiResult::query()->firstOrCreate(
            ['job_id' => $job->id],
            [
                'predicted_type' => $response->predictedType,
                'confidence' => $outcome->confidence,
                'recommended_department' => $response->recommendedDepartment,
                'severity' => $response->severity,
                'quality_score' => $outcome->qualityScore,
                'duplicate_score' => $outcome->duplicateScore,
                'fraud_score' => $outcome->fraudScore,
                'summary' => $response->summary,
                'license_plate' => $response->licensePlate,
                'plate_confidence' => $response->plateConfidence,
                'claim_matches_evidence' => $response->claimMatchesEvidence,
                'consistency_score' => $response->consistencyScore,
                'mismatch_reason' => $response->mismatchReason,
                'synthetic_score' => $response->syntheticScore,
                'raw_response' => $response->raw,
                'created_at' => now(),
            ],
        );
    }

    private function writeLabels(AiResult $result, AiResponse $response, float $confidence): void
    {
        if (AiLabel::query()->where('result_id', $result->id)->exists()) {
            return;
        }

        foreach ($response->labels as $label) {
            AiLabel::query()->create([
                'result_id' => $result->id,
                'label' => $label['label'],
                'confidence' => min($label['confidence'], $confidence),
                'is_primary' => $label['is_primary'],
                'created_at' => now(),
            ]);
        }
    }

    private function markSucceeded(AiJob $job, AiAnalysisOutcome $outcome): void
    {
        $startMs = $job->started_at !== null
            ? (int) $job->started_at->valueOf()
            : (int) (microtime(true) * 1000);
        $endMs = (int) (microtime(true) * 1000);
        $raw = $outcome->response->raw;

        $job->update([
            'status' => AiJob::STATUS_SUCCEEDED,
            'completed_at' => now(),
            'provider_code' => $outcome->providerCode,
            'model' => $outcome->model,
            'processing_time_ms' => max(0, $endMs - $startMs),
            'tokens_in' => is_array($raw['usage'] ?? null)
                && isset($raw['usage']['prompt_tokens'])
                && is_int($raw['usage']['prompt_tokens'])
                    ? $raw['usage']['prompt_tokens']
                    : null,
            'tokens_out' => is_array($raw['usage'] ?? null)
                && isset($raw['usage']['completion_tokens'])
                && is_int($raw['usage']['completion_tokens'])
                    ? $raw['usage']['completion_tokens']
                    : null,
        ]);
    }
}
