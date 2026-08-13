<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Exceptions\AiEvidenceNotReadyException;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\Log;
use Throwable;

final class AiPipelineFailureHandler
{
    public function __construct(
        private readonly SystemUserService $systemUsers,
        private readonly WorkflowEngine $workflow,
    ) {}

    public function handle(string $reportId, ?Throwable $exception): void
    {
        $report = Report::query()->find($reportId);

        if ($report === null) {
            return;
        }

        if ($exception instanceof AiEvidenceNotReadyException) {
            Log::warning('AiPipelineOrchestrator: exhausted retries waiting for evidence', [
                'report_id' => $reportId,
            ]);
        }

        $actor = $this->systemUsers->user();
        $decision = $this->workflow->evaluate($report, 'moderator_review', $actor);

        if ($decision->allowed) {
            $this->workflow->apply($report, $decision, $actor);

            return;
        }

        Log::error('AiPipelineOrchestrator: AI job failed and could not fall back to moderator_review', [
            'report_id' => $reportId,
            'reasons' => $decision->reasons,
            'exception' => $exception?->getMessage(),
        ]);
    }
}
