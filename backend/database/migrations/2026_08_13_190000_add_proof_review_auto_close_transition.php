<?php

declare(strict_types=1);

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $definition = WorkflowDefinition::query()
            ->where('code', 'canonical_report_lifecycle')
            ->first();

        if ($definition === null) {
            return;
        }

        $from = WorkflowState::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('code', 'resolved_pending_verification')
            ->first();
        $to = WorkflowState::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('code', 'closed')
            ->first();

        if ($from === null || $to === null) {
            return;
        }

        WorkflowTransition::query()->updateOrCreate(
            [
                'workflow_definition_id' => $definition->id,
                'from_state_id' => $from->id,
                'event' => 'auto_close',
                'to_state_id' => $to->id,
            ],
            [
                'required_role' => null,
                'required_permission' => null,
                'conditions' => [],
                'sla_minutes' => null,
                'notify_before_minutes' => null,
                'priority' => 95,
                'active' => true,
            ],
        );
    }

    public function down(): void
    {
        $definition = WorkflowDefinition::query()
            ->where('code', 'canonical_report_lifecycle')
            ->first();

        if ($definition === null) {
            return;
        }

        $from = WorkflowState::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('code', 'resolved_pending_verification')
            ->first();
        $to = WorkflowState::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('code', 'closed')
            ->first();

        if ($from === null || $to === null) {
            return;
        }

        WorkflowTransition::query()
            ->where('workflow_definition_id', $definition->id)
            ->where('from_state_id', $from->id)
            ->where('event', 'auto_close')
            ->where('to_state_id', $to->id)
            ->delete();
    }
};
