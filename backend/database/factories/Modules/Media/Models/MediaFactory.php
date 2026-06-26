<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Media\Models;

use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Media>
 */
class MediaFactory extends Factory
{
    protected $model = Media::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'type' => 'PHOTO',
            'storage_disk' => 'local',
            'storage_path' => 'reports/'.Str::uuid()->toString().'.jpg',
            'mime' => 'image/jpeg',
            'size' => $this->faker->numberBetween(50_000, 5_000_000),
            'duration' => null,
            'width' => 1280,
            'height' => 720,
            'checksum' => hash('sha256', Str::random(32)),
            'captured_at' => now()->subMinutes($this->faker->numberBetween(0, 120)),
            'uploaded_at' => now(),
            'uploaded_by' => User::factory(),
            'metadata' => ['source' => 'factory'],
            'version' => 1,
            'is_replaced' => false,
        ];
    }
}
