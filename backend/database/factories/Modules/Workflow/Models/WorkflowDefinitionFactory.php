<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Workflow\Models;

use App\Modules\Workflow\Models\WorkflowDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WorkflowDefinition>
 */
class WorkflowDefinitionFactory extends Factory
{
    protected $model = WorkflowDefinition::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $code = 'wf_'.Str::lower(Str::random(8));

        return [
            'name' => $this->faker->sentence(3),
            'code' => $code,
            'description' => $this->faker->optional()->paragraph(),
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }
}
