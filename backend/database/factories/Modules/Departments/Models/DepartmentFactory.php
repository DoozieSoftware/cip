<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    protected $model = Department::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->company();

        return [
            'name' => $name,
            'code' => strtoupper(Str::limit(Str::slug($name, ''), 8, '')),
            'parent_id' => null,
            'jurisdiction' => 'City-wide',
            'address' => $this->faker->streetAddress(),
            'email' => $this->faker->safeEmail(),
            'phone' => $this->faker->e164PhoneNumber(),
            'working_hours' => [
                'mon' => ['09:00', '18:00'],
                'tue' => ['09:00', '18:00'],
                'wed' => ['09:00', '18:00'],
                'thu' => ['09:00', '18:00'],
                'fri' => ['09:00', '18:00'],
                'sat' => null,
                'sun' => null,
            ],
            'holiday_calendar' => [],
            'default_workflow_id' => null,
            'default_sla_minutes' => 2880,
            'escalation_matrix' => [],
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }

    public function withParent(Department $parent): static
    {
        return $this->state(fn (): array => ['parent_id' => $parent->id]);
    }
}
