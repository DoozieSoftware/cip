<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Exceptions\InvalidAiResponseException;
use App\Modules\AI\Models\AiJob;
use Throwable;

final class AiPipelineRunner
{
    public function __construct(
        private readonly AiEvidenceResolver $evidence,
        private readonly AiProviderAnalysisService $analysis,
        private readonly AiResultWriter $results,
    ) {}

    public function run(string $reportId, ?string $expectedRevision = null): string
    {
        $job = null;

        try {
            $bundle = $this->evidence->resolve($reportId, $expectedRevision);

            if ($this->results->hasSucceeded($reportId, $bundle->revision)) {
                return $bundle->revision;
            }

            $job = $this->results->start($reportId, $bundle->revision);
            $outcome = $this->analysis->analyze(
                $bundle->report,
                $bundle->media,
                $bundle->report->citizen,
            );
            $this->results->complete($job, $bundle->report, $outcome);

            AiCompleted::dispatch(
                $bundle->report->id,
                $outcome->response->predictedType,
                $outcome->response->severity,
                $outcome->response->primaryLabel() ?? $outcome->response->predictedType,
                $outcome->response->licensePlate,
                array_replace(
                    $outcome->response->toArray(),
                    ['confidence' => $outcome->confidence],
                ),
            );

            return $bundle->revision;
        } catch (InvalidAiResponseException $exception) {
            $this->fail($job, 'invalid_ai_response', $exception);

            throw $exception;
        } catch (Throwable $exception) {
            $this->fail($job, 'pipeline_error', $exception);

            throw $exception;
        }
    }

    private function fail(?AiJob $job, string $code, Throwable $exception): void
    {
        if ($job !== null) {
            $this->results->fail($job, $code, $exception);
        }
    }
}
