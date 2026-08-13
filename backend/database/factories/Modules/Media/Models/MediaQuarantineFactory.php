<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Media\Models;

use App\Modules\Media\Enums\MediaQuarantineReason;
use App\Modules\Media\Enums\MediaQuarantineStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaQuarantine;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<MediaQuarantine> */
final class MediaQuarantineFactory extends Factory
{
    protected $model = MediaQuarantine::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'media_id' => Media::factory()->state(['scan_status' => 'UNKNOWN']),
            'status' => MediaQuarantineStatus::PENDING_RESCAN,
            'reason' => MediaQuarantineReason::SCANNER_ERROR,
            'scanner' => 'clamav',
            'original_sha256' => hash('sha256', $this->faker->uuid()),
            'scan_attempts' => 1,
            'last_error' => 'Scanner temporarily unavailable.',
            'quarantined_at' => now(),
            'last_attempted_at' => now(),
            'released_at' => null,
        ];
    }
}
