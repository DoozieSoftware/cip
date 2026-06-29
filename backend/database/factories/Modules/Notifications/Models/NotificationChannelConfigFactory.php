<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Notifications\Models;

use App\Modules\Notifications\Models\NotificationChannelConfig;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NotificationChannelConfig>
 */
class NotificationChannelConfigFactory extends Factory
{
    protected $model = NotificationChannelConfig::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $channel = $this->faker->randomElement(NotificationChannelConfig::CHANNELS);

        return [
            'channel' => $channel,
            'code' => $this->faker->unique()->slug(2),
            'display_name' => $this->faker->company().' '.strtoupper($channel),
            'credentials' => [
                'api_key' => $this->faker->uuid(),
                'host' => $this->faker->domainName(),
            ],
            'retry_policy' => NotificationChannelConfig::DEFAULT_RETRY,
            'settings' => [
                'timeout_ms' => 5000,
            ],
            'per_locale_defaults' => [
                'en' => ['from' => 'noreply@example.com'],
                'hi' => ['from' => 'no-reply@example.in'],
            ],
            'active' => true,
        ];
    }
}
