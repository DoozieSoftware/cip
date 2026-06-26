<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\IdempotencyKey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<IdempotencyKey>
 */
class IdempotencyKeyFactory extends Factory
{
    protected $model = IdempotencyKey::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'key' => (string) Str::uuid(),
            'user_id' => null,
            'route' => 'api.v1.reports.submit',
            'request_hash' => hash('sha256', $this->faker->uuid()),
            'response_status' => 201,
            'response_body' => ['success' => true],
            'created_at' => now(),
        ];
    }
}
