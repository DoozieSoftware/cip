<?php

declare(strict_types=1);

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * P1-07 — adds the `dispute_merge` transition from `merged` to
 * `pending_moderator` so a citizen can dispute an incorrect merge.
 * The merged report leaves the terminal `merged` state and returns
 * to the moderator queue for re-review.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $def = WorkflowDefinition::query()->where('code', 'civic_default')->first();

            if ($def === null) {
                return;
            }

            $merged = WorkflowState::query()
                ->where('workflow_definition_id', $def->id)
                ->where('code', 'merged')
                ->first();

            $pendingModerator = WorkflowState::query()
                ->where('workflow_definition_id', $def->id)
                ->where('code', 'pending_moderator')
                ->first();

            if ($merged === null || $pendingModerator === null) {
                return;
            }

            WorkflowTransition::query()->updateOrCreate(
                [
                    'workflow_definition_id' => $def->id,
                    'from_state_id' => $merged->id,
                    'event' => 'dispute_merge',
                    'to_state_id' => $pendingModerator->id,
                ],
                [
                    'required_role' => null,
                    'required_permission' => null,
                    'conditions' => null,
                    'sla_minutes' => 120,
                    'notify_before_minutes' => 30,
                    'priority' => 0,
                    'active' => true,
                ],
            );

            Cache::forget('workflow:def:code:civic_default');
            Cache::forget("workflow:def:id:{$def->id}");
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $def = WorkflowDefinition::query()->where('code', 'civic_default')->first();

            if ($def === null) {
                return;
            }

            $merged = WorkflowState::query()
                ->where('workflow_definition_id', $def->id)
                ->where('code', 'merged')
                ->first();

            if ($merged === null) {
                return;
            }

            WorkflowTransition::query()
                ->where('workflow_definition_id', $def->id)
                ->where('from_state_id', $merged->id)
                ->where('event', 'dispute_merge')
                ->delete();

            Cache::forget('workflow:def:code:civic_default');
            Cache::forget("workflow:def:id:{$def->id}");
        });
    }
};
