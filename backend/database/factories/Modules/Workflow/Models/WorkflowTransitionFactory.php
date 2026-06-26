<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Workflow\Models;

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkflowTransition>
 */
class WorkflowTransitionFactory extends Factory
{
    protected $model = WorkflowTransition::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'workflow_definition_id' => WorkflowDefinition::factory(),
            'from_state_id' => WorkflowState::factory(),
            'to_state_id' => WorkflowState::factory(),
            'event' => $this->faker->randomElement(['submit', 'approve', 'reject', 'assign', 'resolve']),
            'required_role' => null,
            'required_permission' => null,
            'conditions' => null,
            'sla_minutes' => null,
            'notify_before_minutes' => null,
            'priority' => 0,
            'active' => true,
        ];
    }
}
