<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Media\Models;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MediaAccessLog>
 */
class MediaAccessLogFactory extends Factory
{
    protected $model = MediaAccessLog::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'media_id' => Media::factory(),
            'actor_id' => User::factory(),
            'event' => 'VIEW',
            'ip' => '127.0.0.1',
            'user_agent' => 'CipTest/1.0',
            'metadata' => null,
            'created_at' => now(),
        ];
    }
}
