<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportStatusHistory>
 */
class ReportStatusHistoryFactory extends Factory
{
    protected $model = ReportStatusHistory::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'to_status_id' => ReportStatus::factory(),
            'reason' => $this->faker->optional()->sentence(),
            'metadata' => null,
            'created_at' => now(),
        ];
    }
}
