<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Country>
 */
class CountryFactory extends Factory
{
    protected $model = Country::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->country(),
            'iso2' => strtoupper($this->faker->unique()->lexify('??')),
            'iso3' => strtoupper($this->faker->unique()->lexify('???')),
            'phone_code' => '+'.$this->faker->numberBetween(1, 999),
            'active' => true,
        ];
    }
}
