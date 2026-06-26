<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\ReportPriority;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReportPriority>
 */
class ReportPriorityFactory extends Factory
{
    protected $model = ReportPriority::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = ucfirst($this->faker->unique()->word());

        return [
            'code' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'name' => $name,
            'sla_minutes' => 60 * 24,
            'color' => '#'.Str::upper(Str::random(6)),
            'sort_order' => 0,
            'active' => true,
        ];
    }
}
