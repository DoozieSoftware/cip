<?php

declare(strict_types=1);

namespace App\Modules\AI\Listeners;

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
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

    public function handle(ReportStatusChanged $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            Log::warning('ai.ReportSubmittedListener: report not found', [
                'report_id' => $event->reportId,
            ]);

            return;
        }

        $toStatus = $report->status?->code;

        if ($toStatus !== 'ai_processing') {
            return;
        }

        AiPipelineOrchestrator::dispatch($report->id);
    }
}
