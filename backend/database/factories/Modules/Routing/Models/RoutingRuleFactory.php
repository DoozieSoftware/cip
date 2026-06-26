<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Routing\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoutingRule>
 */
class RoutingRuleFactory extends Factory
{
    protected $model = RoutingRule::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->sentence(3),
            'priority' => 100,
            'conditions' => [
                'category_in' => ['pothole', 'streetlight'],
            ],
            'destination_department_id' => Department::factory(),
            'default_officer_id' => null,
            'default_priority_id' => ReportPriority::factory(),
            'default_sla_minutes' => 1440,
            'active' => true,
            'description' => $this->faker->paragraph(),
        ];
    }

    public function inactive(): static
    {
        return $this->state(['active' => false]);
    }

    public function withOfficer(): static
    {
        return $this->state(['default_officer_id' => User::factory()]);
    }
}
