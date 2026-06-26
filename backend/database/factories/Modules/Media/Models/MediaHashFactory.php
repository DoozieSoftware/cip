<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Media\Models;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MediaHash>
 */
class MediaHashFactory extends Factory
{
    protected $model = MediaHash::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'media_id' => Media::factory(),
            'sha256' => hash('sha256', Str::random(32)),
            'sha512' => hash('sha512', Str::random(32)),
            'perceptual_hash' => bin2hex(random_bytes(8)),
            'video_fingerprint' => null,
            'created_at' => now(),
        ];
    }
}
