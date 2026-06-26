<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Workflow\Models;

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WorkflowState>
 */
class WorkflowStateFactory extends Factory
{
    protected $model = WorkflowState::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'workflow_definition_id' => WorkflowDefinition::factory(),
            'code' => 's_'.Str::lower(Str::random(6)),
            'name' => $this->faker->sentence(2),
            'description' => $this->faker->optional()->sentence(),
            'is_initial' => false,
            'is_terminal' => false,
            'sort_order' => 0,
            'color' => '#'.str_pad(dechex($this->faker->numberBetween(0, 0xFFFFFF)), 6, '0', STR_PAD_LEFT),
            'active' => true,
        ];
    }

    public function initial(): static
    {
        return $this->state(fn (): array => ['is_initial' => true]);
    }

    public function terminal(): static
    {
        return $this->state(fn (): array => ['is_terminal' => true]);
    }
}
