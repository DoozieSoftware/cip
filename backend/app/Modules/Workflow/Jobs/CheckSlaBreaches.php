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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

    private const BATCH_SIZE = 200;

    /** Keep legacy rows without a computed deadline from creating an
     * unbounded migration scan; each run bootstraps at most this many. */
    private const BOOTSTRAP_LIMIT = 1000;

    /**
     * @param  bool  $dryRun  When true, log would-be breaches
     *                        instead of dispatching events.
     */
    public function __construct(
        public readonly bool $dryRun = false,
    ) {}

    public function handle(): int
    {
        $now = Carbon::now();
        $breaches = 0;

        // Only open, due rows are selected through the SLA composite index.
        // A bounded null-deadline bootstrap keeps pre-migration rows moving
        // without reintroducing a full table scan.
        Report::query()
            ->whereNotNull('workflow_id')
            ->whereNotNull('current_status_id')
            ->whereHas('status', static fn ($q) => $q->where('is_terminal', false))
            ->where(function ($q) use ($now): void {
                $q->where('sla_due_at', '<=', $now)->orWhereNull('sla_due_at');
            })
            ->limit(self::BOOTSTRAP_LIMIT)
            ->chunkById(self::BATCH_SIZE, function ($reports) use ($now, &$breaches): void {
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
            if ($report->sla_due_at !== null) {
                $report->sla_due_at = null;
                $report->saveQuietly();
            }

            return 0;
        }

        $enteredAt = $this->enteredCurrentStateAt($report);

        if ($enteredAt === null) {
            return 0;
        }

        $minSla = $transitions->min('sla_minutes');
        $expectedDueAt = is_numeric($minSla) ? $enteredAt->copy()->addMinutes((int) $minSla) : null;

        $sameDueAt = ($report->sla_due_at === null && $expectedDueAt === null)
            || ($report->sla_due_at !== null && $expectedDueAt !== null
                && Carbon::parse($report->sla_due_at)->equalTo($expectedDueAt));

        if (! $sameDueAt) {
            $report->sla_due_at = $expectedDueAt;
            $report->saveQuietly();
        }

        if ($expectedDueAt !== null && $expectedDueAt->isFuture()) {
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

        $newOverdue = [];

        foreach ($overdue as $transition) {
            $inserted = DB::table('workflow_sla_breaches')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'report_id' => $report->id,
                'transition_id' => $transition['transition_id'],
                'breached_at' => $now,
                'payload' => json_encode($transition),
            ]);

            if ($inserted === 1) {
                $newOverdue[] = $transition;
            }
        }

        if ($newOverdue !== []) {
            SlaBreached::dispatch(
                reportId: $report->id,
                currentStateCode: $currentState->code,
                overdueTransitions: $newOverdue,
                elapsedMinutes: $elapsedMinutes,
            );
        }

        return count($newOverdue);
    }

    private function enteredCurrentStateAt(Report $report): ?Carbon
    {
        $row = ReportStatusHistory::query()
            ->where('report_id', $report->id)
            ->where('to_status_id', $report->current_status_id)
            ->orderByDesc('created_at')
            ->first();

        if ($row !== null && $row->created_at !== null) {
            return Carbon::parse($row->created_at);
        }

        // No history yet (e.g. the row was created in
        // `draft` and never transitioned). Use the report's
        // own created_at as the fallback anchor.
        return $report->created_at === null ? null : Carbon::parse($report->created_at);
    }
}
