<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Jobs;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Workflow\Events\SlaBreached;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled job (every 5 minutes, see routes/console.php)
 * that finds reports whose workflow transitions have
 * breached their SLA timer and emits an `SlaBreached`
 * event for each breach.
 *
 * Per docs/03 sec 9, the SLA on a transition is the time
 * the actor has to perform that transition from when the
 * report entered the source state. The job resolves that
 * timestamp from the latest `report_status_history` row
 * for the report.
 *
 * The job is idempotent: re-running it for the same report
 * + transition in the same `elapsed_minutes` window will
 * re-emit the event, but the downstream notifications
 * listener (M9) is expected to de-dupe on the
 * (report_id, transition_id) pair. The job itself does
 * NOT mutate state.
 */
class CheckSlaBreaches implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public int $timeout = 120;

    /**
     * @param  int  $dryRun  When true, log would-be breaches
     *                       instead of dispatching events.
     */
    public function __construct(
        public readonly bool $dryRun = false,
    ) {}

    public function handle(): int
    {
        $now = Carbon::now();
        $breaches = 0;

        // Stream reports that have a workflow + a current status.
        // The query is bounded by the index on workflow_id.
        Report::query()
            ->whereNotNull('workflow_id')
            ->whereNotNull('current_status_id')
            ->chunkById(200, function ($reports) use ($now, &$breaches): void {
                foreach ($reports as $report) {
                    $breaches += $this->checkReport($report, $now);
                }
            });

        Log::info('CheckSlaBreaches completed', [
            'breaches' => $breaches,
            'dry_run' => $this->dryRun,
        ]);

        return $breaches;
    }

    private function checkReport(Report $report, Carbon $now): int
    {
        $currentStatus = ReportStatus::query()->find($report->current_status_id);

        if ($currentStatus === null) {
            return 0;
        }

        $currentState = WorkflowState::query()
            ->where('workflow_definition_id', $report->workflow_id)
            ->where('code', $currentStatus->code)
            ->first();

        if ($currentState === null) {
            return 0;
        }

        $transitions = WorkflowTransition::query()
            ->where('workflow_definition_id', $report->workflow_id)
            ->where('from_state_id', $currentState->id)
            ->where('active', true)
            ->whereNotNull('sla_minutes')
            ->get();

        if ($transitions->isEmpty()) {
            return 0;
        }

        $enteredAt = $this->enteredCurrentStateAt($report);

        if ($enteredAt === null) {
            return 0;
        }

        $elapsedMinutes = (int) $enteredAt->diffInMinutes($now, absolute: false);
        $overdue = [];

        foreach ($transitions as $t) {
            if ($elapsedMinutes > (int) $t->sla_minutes) {
                $overdue[] = [
                    'transition_id' => $t->id,
                    'event' => $t->event,
                    'to_state' => $t->to_state_id,
                    'sla_minutes' => (int) $t->sla_minutes,
                    'elapsed_minutes' => $elapsedMinutes,
                ];
            }
        }

        if ($overdue === []) {
            return 0;
        }

        if ($this->dryRun) {
            Log::warning('SlaBreached (dry-run)', [
                'report_id' => $report->id,
                'current_state' => $currentState->code,
                'overdue' => $overdue,
            ]);

            return count($overdue);
        }

        SlaBreached::dispatch(
            reportId: $report->id,
            currentStateCode: $currentState->code,
            overdueTransitions: $overdue,
            elapsedMinutes: $elapsedMinutes,
        );

        return count($overdue);
    }

    private function enteredCurrentStateAt(Report $report): ?Carbon
    {
        $row = ReportStatusHistory::query()
            ->where('report_id', $report->id)
            ->where('to_status_id', $report->current_status_id)
            ->orderByDesc('created_at')
            ->first();

        if ($row !== null && $row->created_at !== null) {
            return $row->created_at;
        }

        // No history yet (e.g. the row was created in
        // `draft` and never transitioned). Use the report's
        // own created_at as the fallback anchor.
        return $report->created_at;
    }
}
