<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Integrations\Models;

use App\Modules\Integrations\Models\Integration;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Integration>
 */
class IntegrationFactory extends Factory
{
    protected $model = Integration::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => $this->faker->unique()->slug(2),
            'provider' => $this->faker->randomElement(['gmc', 'bbmp', 'pgportal', 'sms_gateway']),
            'display_name' => $this->faker->company(),
            'base_url' => $this->faker->url(),
            'credentials' => [
                'api_key' => $this->faker->uuid(),
                'username' => $this->faker->userName(),
            ],
            'settings' => [
                'timeout_ms' => 5000,
                'retry_count' => 3,
            ],
            'status' => 'active',
        ];
    }
}
