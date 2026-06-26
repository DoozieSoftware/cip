<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Settings\Models;

use App\Modules\Settings\Models\Setting;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Setting>
 */
class SettingFactory extends Factory
{
    protected $model = Setting::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->word().'.'.Str::random(6),
            'value' => $this->faker->word(),
            'type' => 'string',
            'description' => $this->faker->sentence(),
            'is_public' => false,
        ];
    }
}
