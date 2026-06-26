<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportAssignment>
 */
class ReportAssignmentFactory extends Factory
{
    protected $model = ReportAssignment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'department_id' => Department::factory(),
            'officer_id' => null,
            'assigned_by' => null,
            'assigned_at' => now(),
            'accepted_at' => null,
            'completed_at' => null,
            'reassignment_reason' => null,
        ];
    }
}
