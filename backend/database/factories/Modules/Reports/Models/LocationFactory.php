<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    protected $model = Location::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Bengaluru-centered coordinates as a sensible default for
        // a citizen reporting tool. Override in tests as needed.
        return [
            'latitude' => 12.97 + ($this->faker->randomFloat(6, -0.1, 0.1)),
            'longitude' => 77.59 + ($this->faker->randomFloat(6, -0.1, 0.1)),
            'altitude' => $this->faker->optional(0.5)->randomFloat(2, 900, 950),
            'accuracy' => $this->faker->randomFloat(2, 5, 50),
            'heading' => $this->faker->optional(0.5)->randomFloat(2, 0, 360),
            'speed' => null,
            'gps_provider' => 'fused',
            'captured_at' => now(),
            'address' => null,
        ];
    }
}
