<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Services;

use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Exceptions\InvalidTransitionException;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\ValueObjects\WorkflowDecision;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The M6 workflow engine. Resolves a (state, event) pair
 * against the configured transitions and either:
 *
 *  - returns a positive `WorkflowDecision` (with the
 *    destination state, the matched transition, and the
 *    SLA hints), or
 *  - returns a negative `WorkflowDecision` listing the
 *    reasons.
 *
 * The engine is the *only* place that knows the priority
 * tie-break and the role / permission / conditions
 * contract. Reports never reach a `WorkflowTransition`
 * row directly — they go through `evaluate()` first.
 *
 * The engine bridges the M4 `report_statuses` flat enum
 * to the M6 `workflow_states` graph: it looks up the
 * matching `WorkflowState` by `code` within the report's
 * `workflow_id` definition. The same `code` is the natural
 * key in both tables (per docs/04 §7 + §11).
 */
class WorkflowEngine
{
    public function __construct(
        private readonly TransitionGuard $guard,
    ) {}

    /**
     * Resolve `(report, event, actor) -> WorkflowDecision`.
     *
     * The result is deterministic for a given `(definition_id,
     * from_state_code, event, actor)` tuple: the highest-priority
     * transition that the guard accepts wins. The matching
     * transition's `id` is the audit-trail anchor.
     */
    public function evaluate(Report $report, string $event, ?User $actor): WorkflowDecision
    {
        if ($event === '') {
            return WorkflowDecision::deny(['event is required.']);
        }

        $definition = $this->definitionFor($report);

        if ($definition === null) {
            return WorkflowDecision::deny(['Report has no workflow definition.']);
        }

        $fromState = $this->currentState($report, $definition);

        if ($fromState === null) {
            return WorkflowDecision::deny(['Report has no current workflow state.']);
        }

        $transitions = $this->candidates($definition, $fromState, $event);

        if ($transitions === []) {
            return WorkflowDecision::deny([
                "No transition for event '{$event}' from state '{$fromState->code}'.",
            ]);
        }

        if ($actor === null) {
            // System-triggered events pass when the matched
            // transition has no role / permission / condition
            // gates; otherwise deny.
            foreach ($transitions as $t) {
                if ($t->required_role === null && $t->required_permission === null
                    && (empty($t->conditions))) {
                    return $this->positive($t);
                }
            }

            return WorkflowDecision::deny([
                "Event '{$event}' has gated transitions but no actor was supplied.",
            ]);
        }

        $reasons = [];

        foreach ($transitions as $t) {
            try {
                $this->guard->ensure($t, $actor, $report);

                return $this->positive($t);
            } catch (InvalidTransitionException $e) {
                $reasons[] = $e->getMessage();
            } catch (Throwable $e) {
                $reasons[] = $e->getMessage();
            }
        }

        if ($reasons === []) {
            $reasons[] = 'No transition matched the guard.';
        }

        return WorkflowDecision::deny($reasons);
    }

    /**
     * Apply a positive decision. Updates the report's
     * `current_status_id` (by mapping the destination
     * workflow_state back to the matching `report_statuses`
     * row by code), writes the audit row, and dispatches
     * `ReportStatusChanged`.
     *
     * @throws \InvalidArgumentException when the decision
     *                                   is not a positive one
     */
    public function apply(Report $report, WorkflowDecision $decision, ?User $actor): Report
    {
        if (! $decision->allowed) {
            throw new \InvalidArgumentException('Cannot apply a denied decision.');
        }

        if ($decision->toStateId === null || $decision->matchedTransitionId === null) {
            throw new \InvalidArgumentException('Decision is missing target fields.');
        }

        $toState = WorkflowState::query()->find($decision->toStateId);

        if ($toState === null) {
            throw new \InvalidArgumentException("Target state '{$decision->toStateId}' not found.");
        }

        $fromStateId = $report->current_status_id;

        DB::transaction(function () use ($report, $toState, $decision, $actor, $fromStateId): void {
            // Bridge the M4/M6 gap: the destination workflow
            // state's code matches a `report_statuses` row.
            $toStatus = ReportStatus::query()->where('code', $toState->code)->first();

            if ($toStatus !== null) {
                $report->current_status_id = $toStatus->id;
                $report->save();
            }

            // The WriteStatusHistory listener (M4) is auto-wired
            // and appends a status-history row when this event
            // fires. Do not write twice.
            ReportStatusChanged::dispatch(
                reportId: $report->id,
                fromStatusId: $fromStateId,
                toStatusId: $toStatus?->id ?? $toState->id,
                actorId: $actor?->id,
                reason: 'workflow.transition:'.$decision->matchedTransitionId,
                metadata: [
                    'transition_id' => $decision->matchedTransitionId,
                    'sla_minutes' => $decision->slaMinutes,
                    'notify_before_minutes' => $decision->notifyBeforeMinutes,
                ],
            );
        });

        return $report->refresh();
    }

    private function definitionFor(Report $report): ?WorkflowDefinition
    {
        if ($report->workflow_id === null) {
            return null;
        }

        return WorkflowDefinition::query()->find($report->workflow_id);
    }

    private function currentState(Report $report, WorkflowDefinition $definition): ?WorkflowState
    {
        if ($report->current_status_id === null) {
            return null;
        }
        $status = ReportStatus::query()->find($report->current_status_id);

        if ($status === null) {
            return null;
        }

        // The M4 status code matches a M6 workflow_state
        // code within the report's definition.
        return WorkflowState::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('code', $status->code)
            ->first();
    }

    /**
     * @return list<WorkflowTransition>
     */
    private function candidates(WorkflowDefinition $def, WorkflowState $from, string $event): array
    {
        return WorkflowTransition::query()
            ->where('workflow_definition_id', $def->id)
            ->where('from_state_id', $from->id)
            ->where('event', $event)
            ->where('active', true)
            ->orderByDesc('priority')
            ->orderBy('created_at')
            ->get()
            ->all();
    }

    private function positive(WorkflowTransition $t): WorkflowDecision
    {
        $reasons = [
            "matched event='{$t->event}' from state_id={$t->from_state_id} as transition '{$t->id}' (priority {$t->priority}).",
        ];

        return WorkflowDecision::allow(
            toStateId: $t->to_state_id,
            matchedTransitionId: $t->id,
            slaMinutes: $t->sla_minutes,
            notifyBeforeMinutes: $t->notify_before_minutes,
            reasons: $reasons,
        );
    }
}
