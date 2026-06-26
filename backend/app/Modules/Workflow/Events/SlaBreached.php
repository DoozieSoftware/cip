<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `CheckSlaBreaches` when a report has been in
 * a workflow state longer than the configured `sla_minutes`
 * of one or more of its outgoing transitions.
 *
 * The Sla notification listener (M9) consumes this event
 * to push a notification to the assigned role / department.
 * The M6 audit log is NOT written by this event; the
 * transition itself is the auditable act. SlaBreached is
 * a domain event for downstream workflows.
 *
 * The constructor carries the report id, the state code the
 * report is currently in, the list of overdue transitions
 * with their SLA targets, and the elapsed minutes.
 */
final class SlaBreached
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  list<array{transition_id: string, event: string, to_state: string, sla_minutes: int, elapsed_minutes: int}>  $overdueTransitions
     */
    public function __construct(
        public readonly string $reportId,
        public readonly string $currentStateCode,
        public readonly array $overdueTransitions,
        public readonly int $elapsedMinutes,
    ) {}
}
