<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Settings\Models\AppConfig;
use Illuminate\Database\Seeder;

/**
 * Master data: the 10 default feature flags per docs/09 §18.
 *
 * Every flag carries:
 *  - `enabled` — the master switch
 *  - `rollout_percentage` — 0-100, deterministic SHA-256 bucket
 *  - `cohort` — optional predicate array
 *  - `value` — optional JSON payload the application reads
 *    when the flag is on
 *  - `description` — human-readable explanation for the Super
 *    Admin UI
 *
 * The seeder is idempotent — `updateOrCreate` on `key`.
 */
class AppConfigsSeeder extends Seeder
{
    /**
     * @var list<array<string, mixed>>
     */
    private const FLAGS = [
        [
            'key' => 'anonymous_reporting',
            'value' => true,
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Allows citizens to submit reports without authentication.',
        ],
        [
            'key' => 'ai_enabled',
            'value' => ['providers' => ['local'], 'fallback' => 'local'],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Routes vision + OCR inference through the AI provider chain.',
        ],
        [
            'key' => 'ocr_enabled',
            'value' => ['languages' => ['en', 'kn', 'hi']],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Extracts text from images via the OCR provider.',
        ],
        [
            'key' => 'video_mandatory',
            'value' => false,
            'enabled' => false,
            'rollout_percentage' => 0,
            'cohort' => null,
            'description' => 'Require a video attachment for every report.',
        ],
        [
            'key' => 'moderator_required',
            'value' => true,
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Block AI-only decisions — a moderator must always sign off.',
        ],
        [
            'key' => 'public_dashboard',
            'value' => true,
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Expose the public reports dashboard without authentication.',
        ],
        [
            'key' => 'offline_mode',
            'value' => ['queue_depth' => 50],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Citizen PWA queues reports when offline and replays on reconnect.',
        ],
        [
            'key' => 'push_notifications',
            'value' => ['channels' => ['fcm', 'apns']],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Citizen-facing push notifications for status changes.',
        ],
        [
            'key' => 'fraud_detection',
            'value' => ['threshold' => 0.85],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'AI-assisted fraud scoring on incoming reports.',
        ],
        [
            'key' => 'duplicate_detection',
            'value' => ['radius_meters' => 50, 'lookback_days' => 14],
            'enabled' => true,
            'rollout_percentage' => 100,
            'cohort' => null,
            'description' => 'Detect near-duplicate reports within a 50m / 14-day window.',
        ],
    ];

    public function run(): void
    {
        foreach (self::FLAGS as $row) {
            AppConfig::query()->updateOrCreate(
                ['key' => $row['key']],
                $row,
            );
        }
    }
}
