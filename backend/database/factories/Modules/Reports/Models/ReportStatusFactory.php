<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\ReportStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReportStatus>
 */
class ReportStatusFactory extends Factory
{
    protected $model = ReportStatus::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = ucfirst($this->faker->unique()->word());

        return [
            'code' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'name' => $name,
            'description' => $this->faker->sentence(),
            'color' => '#'.Str::upper(Str::random(6)),
            'is_terminal' => false,
            'sort_order' => 0,
            'active' => true,
        ];
    }
}
