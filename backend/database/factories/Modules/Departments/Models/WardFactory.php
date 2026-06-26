<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ward>
 */
class WardFactory extends Factory
{
    protected $model = Ward::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'city_id' => City::factory(),
            'zone_id' => Zone::factory(),
            'ward_number' => $this->faker->unique()->numberBetween(1, 100),
            'name' => 'Ward '.$this->faker->numberBetween(1, 100),
            'municipality' => $this->faker->city().' Municipal Corporation',
            'active' => true,
            // A trivial closed polygon (square) in WKT. Real boundary
            // data lands via the seeder / Super Admin Portal.
            'boundary_polygon' => 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))',
        ];
    }
}
