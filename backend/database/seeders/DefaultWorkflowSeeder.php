<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the default civic report workflow per docs/02 §7.
 *
 * Canonical lifecycle (14 states, 23 transitions):
 *
 *   draft --submit--> submitted --ai_complete--> ai_processing
 *     |--moderator_review--> pending_moderator
 *     |--ai_auto_assign--> assigned
 *
 *   pending_moderator --assign|---------> assigned
 *                    |--approve|---------> assigned
 *                    |--escalate-------> escalated
 *                    |--merge----------> merged
 *                    |--reject---------> rejected
 *
 *   assigned --accept--> accepted
 *            |--reject--> rejected
 *
 *   accepted -------> start --> in_progress
 *            |--reject-----> rejected
 *
 *   in_progress --resolve--> resolved_pending_verification
 *              |--reject----> rejected
 *
 *   resolved_pending_verification --verify-------> verified  (citizen)
 *                                |--dispute-----> reopened  (citizen)
 *                                |--close-------> closed    (supervisor override)
 *
 *   verified --close--> closed
 *
 *   reopened --resolve--> resolved_pending_verification
 *
 *   escalated --review--> pending_moderator  (supervisor)
 *            |--assign--> assigned           (supervisor)
 *
 *   merged --dispute_merge--> pending_moderator  (citizen)
 *
 * Owners / allowed actors:
 *   citizen              : submit, verify, dispute, dispute_merge
 *   system               : ai_complete, moderator_review, ai_auto_assign
 *   moderator            : assign, approve, reject, escalate, merge,
 *                          close (supervisor override + final), review
 *   department_officer   : accept, start, resolve, reject
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
                    'description' => 'Canonical lifecycle: draft → submitted → ai_processing → pending_moderator → assigned → accepted → in_progress → resolved_pending_verification → verified → closed. Supports citizen verification, reopening, supervisor escalation, and merge dispute.',
                    'active' => true,
                ],
            );

            $states = $this->seedStates($def->id);
            $this->seedTransitions($def->id, $states);
            Cache::forget('workflow:def:code:civic_default');
            Cache::forget("workflow:def:id:{$def->id}");
        });
    }

    /**
     * @return array<string, WorkflowState>
     */
    private function seedStates(string $defId): array
    {
        $rows = [
            ['code' => 'draft',                        'name' => 'Draft',                        'is_initial' => true,  'is_terminal' => false, 'sort_order' => 10,  'color' => '#9E9E9E'],
            ['code' => 'submitted',                    'name' => 'Submitted',                    'is_initial' => false, 'is_terminal' => false, 'sort_order' => 20,  'color' => '#2196F3'],
            ['code' => 'ai_processing',                'name' => 'AI Processing',                'is_initial' => false, 'is_terminal' => false, 'sort_order' => 30,  'color' => '#9C27B0'],
            ['code' => 'pending_moderator',            'name' => 'Pending Moderator',            'is_initial' => false, 'is_terminal' => false, 'sort_order' => 40,  'color' => '#FF9800'],
            ['code' => 'assigned',                     'name' => 'Assigned',                     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 50,  'color' => '#3F51B5'],
            ['code' => 'accepted',                     'name' => 'Accepted',                     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 60,  'color' => '#1976D2'],
            ['code' => 'in_progress',                  'name' => 'In Progress',                  'is_initial' => false, 'is_terminal' => false, 'sort_order' => 70,  'color' => '#03A9F4'],
            ['code' => 'resolved',                     'name' => 'Resolved',                     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 75,  'color' => '#4CAF50'],
            ['code' => 'resolved_pending_verification', 'name' => 'Resolved — Pending Verification', 'is_initial' => false, 'is_terminal' => false, 'sort_order' => 80,  'color' => '#66BB6A'],
            ['code' => 'verified',                     'name' => 'Verified',                     'is_initial' => false, 'is_terminal' => true,  'sort_order' => 85,  'color' => '#1B5E20'],
            ['code' => 'reopened',                     'name' => 'Reopened',                     'is_initial' => false, 'is_terminal' => false, 'sort_order' => 87,  'color' => '#FF7043'],
            ['code' => 'closed',                       'name' => 'Closed',                       'is_initial' => false, 'is_terminal' => true,  'sort_order' => 90,  'color' => '#212121'],
            ['code' => 'rejected',                     'name' => 'Rejected',                     'is_initial' => false, 'is_terminal' => true,  'sort_order' => 100, 'color' => '#F44336'],
            ['code' => 'merged',                       'name' => 'Merged',                       'is_initial' => false, 'is_terminal' => true,  'sort_order' => 110, 'color' => '#7B1FA2'],
            ['code' => 'escalated',                    'name' => 'Escalated',                    'is_initial' => false, 'is_terminal' => false, 'sort_order' => 120, 'color' => '#E91E63'],
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
            // from             event              to                          role                    sla
            ['draft',                        'submit',            'submitted',                    null,                    null],
            ['submitted',                    'ai_complete',       'ai_processing',                'system',                30],
            ['ai_processing',                'moderator_review',  'pending_moderator',            'system',                30],
            ['ai_processing',                'ai_auto_assign',    'assigned',                     'system',                120],
            ['pending_moderator',            'assign',            'assigned',                     'moderator',             120],
            ['pending_moderator',            'approve',           'assigned',                     'moderator',             120],
            ['pending_moderator',            'escalate',          'escalated',                    'moderator',             null],
            ['pending_moderator',            'merge',             'merged',                       'moderator',             null],
            ['pending_moderator',            'reject',            'rejected',                     'moderator',             null],
            ['assigned',                     'accept',            'accepted',                     'department_officer',    240],
            ['assigned',                     'reject',            'rejected',                     'department_officer',    null],
            ['accepted',                     'start',             'in_progress',                  'department_officer',    1440],
            ['accepted',                     'reject',            'rejected',                     'department_officer',    null],
            ['in_progress',                  'resolve',           'resolved_pending_verification', 'department_officer',   4320],
            ['in_progress',                  'reject',            'rejected',                     'department_officer',    null],
            // Citizen verification paths.
            ['resolved_pending_verification', 'verify',           'verified',                     null,                    2880],
            ['resolved_pending_verification', 'dispute',          'reopened',                     null,                    null],
            // Supervisor override close.
            ['resolved_pending_verification', 'close',            'closed',                       'moderator',             null],
            // Final close after citizen verification.
            ['verified',                     'close',             'closed',                       'moderator',             null],
            // Reopened cycle.
            ['reopened',                     'resolve',           'resolved_pending_verification', 'department_officer',   4320],
            // Supervisor escalation exit.
            ['escalated',                    'review',            'pending_moderator',            'moderator',             240],
            ['escalated',                    'assign',            'assigned',                     'moderator',             240],
            // Citizen merge dispute.
            ['merged',                       'dispute_merge',     'pending_moderator',            null,                    120],
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
