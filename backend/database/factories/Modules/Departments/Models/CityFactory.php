<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\District;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<City>
 */
class CityFactory extends Factory
{
    protected $model = City::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'district_id' => District::factory(),
            'name' => $this->faker->city(),
            'code' => strtoupper($this->faker->unique()->lexify('??')),
            'active' => true,
        ];
    }
}
