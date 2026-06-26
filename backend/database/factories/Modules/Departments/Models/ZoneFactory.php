<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Zone;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Zone>
 */
class ZoneFactory extends Factory
{
    protected $model = Zone::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'city_id' => City::factory(),
            'name' => $this->faker->city(),
            'code' => strtoupper($this->faker->unique()->lexify('??')),
            'active' => true,
        ];
    }
}
