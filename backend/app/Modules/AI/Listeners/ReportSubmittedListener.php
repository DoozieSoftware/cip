<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\Log;

/**
 * Bridges the M4/M6 report lifecycle into the M8 AI
 * vision pipeline. The listener is registered for the
 * `ReportStatusChanged` event and advances a finalized report
 * into `ai_processing`. Dispatch is intentionally owned by
 * `ReportEvidenceReadyListener` after the evidence gate.
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
 * Failure handling remains in the orchestrator once the evidence-ready
 * event has dispatched it; AI never runs on an incomplete draft.
 */
class ReportSubmittedListener
{
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

        // AI is deliberately not dispatched here. Finalization emits the
        // report-scoped ReportEvidenceReady event only after every required
        // asset is durable and hash-ready; that event is the sole AI boundary.
    }
}
