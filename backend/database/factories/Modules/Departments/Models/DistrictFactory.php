<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<District>
 */
class DistrictFactory extends Factory
{
    protected $model = District::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'state_id' => State::factory(),
            'name' => $this->faker->city().' District',
            'code' => strtoupper($this->faker->unique()->lexify('??')),
            'active' => true,
        ];
    }
}
