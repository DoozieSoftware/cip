<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the default civic report workflow per docs/02 §7.
 *
 * Mirrors the 11 `report_statuses` rows (Draft, Submitted,
 * AI Processing, Pending Moderator, Assigned, Accepted,
 * In Progress, Resolved, Verified, Closed, Rejected) as
 * a single `WorkflowDefinition` with matching
 * `WorkflowState` codes, then wires the transitions:
 *
 *   draft          --submit-->        submitted
 *   submitted      --ai_complete-->   ai_processing
 *   ai_processing  --moderator_review--> pending_moderator
 *   pending_moderator --assign-->     assigned
 *   assigned       --accept-->        accepted
 *   accepted       --start-->         in_progress
 *   in_progress    --resolve-->       resolved
 *   resolved       --verify-->        verified
 *   verified       --close-->         closed
 *
 *   pending_moderator --reject-->     rejected   (any of
 *   assigned          --reject-->     rejected    the staff
 *   accepted          --reject-->     rejected    states)
 *   in_progress       --reject-->     rejected
 *
 * The 4 reject transitions all carry the same event
 * (`reject`) and are scoped to the relevant from-state
 * via the transition row. The M6 engine resolves the
 * winning transition by (from_state, event) — see
 * WorkflowEngine::evaluate().
 *
 * Idempotent: uses updateOrCreate on every row by
 * natural key so re-running is a no-op.
 */
class DefaultWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $def = WorkflowDefinition::query()->updateOrCreate(
                ['code' => 'civic_default'],
                [
                    'name' => 'Civic Report (default)',
                    'description' => 'Default 13-state lifecycle per docs/02 §7 + M10 moderation (merged, escalated).',
                    'active' => true,
                ],
            );

            $states = $this->seedStates($def->id);
            $this->seedTransitions($def->id, $states);
        });
    }

    /**
     * @return array<string, WorkflowState>
     */
    private function seedStates(string $defId): array
    {
        $rows = [
            ['code' => 'draft',             'name' => 'Draft',             'is_initial' => true,  'is_terminal' => false, 'sort_order' => 10, 'color' => '#9E9E9E'],
            ['code' => 'submitted',         'name' => 'Submitted',         'is_initial' => false, 'is_terminal' => false, 'sort_order' => 20, 'color' => '#2196F3'],
            ['code' => 'ai_processing',     'name' => 'AI Processing',     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 30, 'color' => '#9C27B0'],
            ['code' => 'pending_moderator', 'name' => 'Pending Moderator', 'is_initial' => false, 'is_terminal' => false, 'sort_order' => 40, 'color' => '#FF9800'],
            ['code' => 'assigned',          'name' => 'Assigned',          'is_initial' => false, 'is_terminal' => false, 'sort_order' => 50, 'color' => '#3F51B5'],
            ['code' => 'accepted',          'name' => 'Accepted',          'is_initial' => false, 'is_terminal' => false, 'sort_order' => 60, 'color' => '#1976D2'],
            ['code' => 'in_progress',       'name' => 'In Progress',       'is_initial' => false, 'is_terminal' => false, 'sort_order' => 70, 'color' => '#03A9F4'],
            ['code' => 'resolved',          'name' => 'Resolved',          'is_initial' => false, 'is_terminal' => false, 'sort_order' => 80, 'color' => '#4CAF50'],
            ['code' => 'verified',          'name' => 'Verified',          'is_initial' => false, 'is_terminal' => true,  'sort_order' => 90, 'color' => '#1B5E20'],
            ['code' => 'closed',            'name' => 'Closed',            'is_initial' => false, 'is_terminal' => true,  'sort_order' => 100, 'color' => '#212121'],
            ['code' => 'rejected',          'name' => 'Rejected',          'is_initial' => false, 'is_terminal' => true,  'sort_order' => 110, 'color' => '#F44336'],
            ['code' => 'merged',            'name' => 'Merged',            'is_initial' => false, 'is_terminal' => true,  'sort_order' => 120, 'color' => '#7B1FA2'],
            ['code' => 'escalated',         'name' => 'Escalated',         'is_initial' => false, 'is_terminal' => false, 'sort_order' => 130, 'color' => '#E91E63'],
        ];

        $states = [];

        foreach ($rows as $row) {
            $states[$row['code']] = WorkflowState::query()->updateOrCreate(
                ['workflow_definition_id' => $defId, 'code' => $row['code']],
                $row + ['description' => null, 'active' => true],
            );
        }

        return $states;
    }

    /**
     * @param  array<string, WorkflowState>  $states
     */
    private function seedTransitions(string $defId, array $states): void
    {
        $t = [
            // from             event              to                    role          sla
            ['draft',             'submit',            'submitted',         null,         null],
            ['submitted',         'ai_complete',       'ai_processing',     'system',     30],
            ['ai_processing',     'moderator_review',  'pending_moderator', 'system',     30],
            ['ai_processing',     'ai_auto_assign',    'assigned',          'system',     120],
            ['pending_moderator', 'assign',            'assigned',          'moderator',  120],
            ['pending_moderator', 'approve',           'assigned',          'moderator',  120],
            ['pending_moderator', 'escalate',          'escalated',         'moderator',  null],
            ['pending_moderator', 'merge',             'merged',            'moderator',  null],
            ['assigned',          'accept',            'accepted',          'department_officer', 240],
            ['accepted',          'start',             'in_progress',       'department_officer', 1440],
            ['in_progress',       'resolve',           'resolved',          'department_officer', 4320],
            ['resolved',          'verify',            'verified',          'moderator',  1440],
            ['verified',          'close',             'closed',            'moderator',  4320],

            // Reject branch — any of the staff-side states.
            ['pending_moderator', 'reject',            'rejected',          'moderator',  null],
            ['assigned',          'reject',            'rejected',          'department_officer', null],
            ['accepted',          'reject',            'rejected',          'department_officer', null],
            ['in_progress',       'reject',            'rejected',          'department_officer', null],
        ];

        foreach ($t as [$from, $event, $to, $role, $slaMinutes]) {
            WorkflowTransition::query()->updateOrCreate(
                [
                    'workflow_definition_id' => $defId,
                    'from_state_id' => $states[$from]->id,
                    'event' => $event,
                    'to_state_id' => $states[$to]->id,
                ],
                [
                    'required_role' => $role,
                    'required_permission' => null,
                    'conditions' => null,
                    'sla_minutes' => $slaMinutes,
                    'notify_before_minutes' => $slaMinutes !== null ? (int) max(15, (int) ($slaMinutes * 0.2)) : null,
                    'priority' => 0,
                    'active' => true,
                ],
            );
        }
    }
}
