<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Report>
 */
class ReportFactory extends Factory
{
    protected $model = Report::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'citizen_id' => User::factory(),
            'report_type_id' => ReportType::factory(),
            'current_status_id' => ReportStatus::factory(),
            'priority_id' => ReportPriority::factory(),
            'location_id' => Location::factory(),
            'title' => $this->faker->sentence(4),
            'description' => $this->faker->paragraph(),
            'is_anonymous' => false,
            'is_verified' => false,
        ];
    }

    public function anonymous(): static
    {
        return $this->state(fn (): array => [
            'citizen_id' => null,
            'is_anonymous' => true,
        ]);
    }

    public function submitted(): static
    {
        return $this->state(fn (): array => [
            'submitted_at' => now(),
        ]);
    }
}
