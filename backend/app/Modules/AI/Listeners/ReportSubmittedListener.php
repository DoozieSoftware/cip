<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

/**
 * Bridges the M4/M6 report lifecycle into the M8 AI
 * vision pipeline. The listener is registered for the
 * `ReportStatusChanged` event and dispatches the
 * `AiPipelineOrchestrator` job whenever a report moves
 * into the `ai_processing` state.
 *
 * Why this event and not a brand-new `ReportSubmitted`
 * event:
 *  - the workflow engine (M6) is the single source of
 *    truth for status transitions; the listener is
 *    therefore automatically consistent with whatever
 *    path the report took (citizen submit, API integration,
 *    or admin backfill)
 *  - it avoids hand-wiring the dispatch in the
 *    ReportService, which would couple it to the
 *    Citizen PWA and bypass the workflow engine
 *
 * Failure handling:
 *  - if the orchestrator job is dispatched but later
 *    fails, the orchestrator itself marks the
 *    `ai_jobs` row as `failed` and rethrows; the
 *    queue worker records the failure and the M7
 *    RoutingFallbackService + M6 workflow
 *    `moderator_review` transition route the report
 *    to a human as the safety net
 */
class ReportSubmittedListener implements ShouldQueue
{
    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(
        private readonly WorkflowEngine $workflowEngine,
        private readonly SystemUserService $systemUser,
    ) {}

    public function handle(ReportStatusChanged $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            Log::warning('ai.ReportSubmittedListener: report not found', [
                'report_id' => $event->reportId,
            ]);

            return;
        }

        $toStatus = $report->refresh()->status?->code;

        if ($toStatus === 'submitted') {
            // Nothing else auto-advances a freshly submitted report into
            // `ai_processing` — the `ai_complete` transition is gated
            // `required_role: system`, so it needs a real actor with the
            // `system` role, not a null/guest actor. Applying it here
            // dispatches ReportStatusChanged again, which re-invokes this
            // same listener with toStatus === 'ai_processing' below.
            $systemActor = $this->systemUser->user();
            $decision = $this->workflowEngine->evaluate($report, 'ai_complete', $systemActor);

            if ($decision->allowed) {
                $this->workflowEngine->apply($report, $decision, $systemActor);
            } else {
                Log::warning('ai.ReportSubmittedListener: could not auto-advance to ai_processing', [
                    'report_id' => $report->id,
                    'reasons' => $decision->reasons,
                ]);
            }

            return;
        }

        if ($toStatus !== 'ai_processing') {
            return;
        }

        // Only dispatch if the pipeline is actually wired. The
        // orchestrator inserts an ai_jobs row that FK-restricts
        // on prompt_versions and ai_provider_configs, so dispatching
        // blindly would 500 in test environments that haven't seeded
        // the AI stack.
        $hasApprovedPrompt = \App\Modules\AI\Models\PromptVersion::query()
            ->where('name', 'category_classifier')
            ->where('status', \App\Modules\AI\Models\PromptVersion::STATUS_APPROVED)
            ->exists();
        $hasActiveProvider = \App\Modules\AI\Models\AiProviderConfig::query()
            ->where('active', true)
            ->exists();

        if (! $hasApprovedPrompt || ! $hasActiveProvider) {
            \Illuminate\Support\Facades\Log::debug('ai.ReportSubmittedListener: pipeline not wired', [
                'has_approved_prompt' => $hasApprovedPrompt,
                'has_active_provider' => $hasActiveProvider,
            ]);
            return;
        }

        AiPipelineOrchestrator::dispatch($report->id);
    }
}
