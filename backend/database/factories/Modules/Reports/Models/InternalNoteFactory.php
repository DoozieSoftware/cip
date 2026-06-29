<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\InternalNote;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InternalNote>
 */
class InternalNoteFactory extends Factory
{
    protected $model = InternalNote::class;

    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'department_id' => Department::factory(),
            'author_id' => User::factory(),
            'body' => $this->faker->sentence(12),
            'created_at' => now(),
        ];
    }
}
