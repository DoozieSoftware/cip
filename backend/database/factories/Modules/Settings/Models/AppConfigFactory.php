<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Settings\Models;

use App\Modules\Settings\Models\AppConfig;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<AppConfig>
 */
class AppConfigFactory extends Factory
{
    protected $model = AppConfig::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->word().'.'.Str::random(6),
            'value' => true,
            'enabled' => false,
            'rollout_percentage' => 0,
            'cohort' => null,
            'description' => $this->faker->sentence(),
        ];
    }

    public function enabled(int $rollout = 100): static
    {
        return $this->state(fn (): array => [
            'enabled' => true,
            'rollout_percentage' => $rollout,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $cohort
     */
    public function withCohort(array $cohort): static
    {
        return $this->state(fn (): array => ['cohort' => $cohort]);
    }
}
