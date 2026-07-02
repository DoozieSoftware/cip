<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Database\Seeder;

/**
 * Seeds the default security policies per docs/09 §19.
 *
 * Idempotent: `updateOrCreate` on `key`. New policies
 * can be added without bumping the seeder; the Super
 * Admin screen creates and edits rows at runtime.
 */
class SecurityPoliciesSeeder extends Seeder
{
    /**
     * @var list<array{key: string, value: array<string, mixed>, type: string, description: string}>
     */
    private const DEFAULTS = [
        [
            'key' => 'password.min_length',
            'value' => ['min' => 12, 'require_mixed_case' => true, 'require_symbol' => true, 'require_number' => true],
            'type' => 'array',
            'description' => 'Password length and complexity rules (docs/11 §8): staff accounts only — citizens are OTP-only and exempt. Read by SecurityPolicyService::passwordRule().',
        ],
        [
            'key' => 'otp.expiry_seconds',
            'value' => ['seconds' => 300],
            'type' => 'array',
            'description' => 'OTP validity in seconds.',
        ],
        [
            'key' => 'jwt.access_ttl_minutes',
            'value' => ['minutes' => 60],
            'type' => 'array',
            'description' => 'Access token lifetime.',
        ],
        [
            'key' => 'jwt.refresh_ttl_days',
            'value' => ['days' => 30],
            'type' => 'array',
            'description' => 'Refresh token lifetime.',
        ],
        [
            'key' => 'session.timeout_minutes',
            'value' => ['minutes' => 30],
            'type' => 'array',
            'description' => 'Idle session timeout for authenticated users.',
        ],
        [
            'key' => 'ratelimit.otp_per_hour',
            'value' => ['per_hour' => 5],
            'type' => 'array',
            'description' => 'Maximum OTP requests per phone per hour.',
        ],
        [
            'key' => 'media.max_upload_mb',
            'value' => ['mb' => 25],
            'type' => 'array',
            'description' => 'Maximum single media upload size.',
        ],
        [
            'key' => 'media.max_video_seconds',
            'value' => ['seconds' => 60],
            'type' => 'array',
            'description' => 'Maximum video clip length.',
        ],
        [
            'key' => 'media.max_photos_per_report',
            'value' => ['max' => 5],
            'type' => 'array',
            'description' => 'Maximum photos per report.',
        ],
    ];

    public function run(): void
    {
        foreach (self::DEFAULTS as $row) {
            SecurityPolicy::query()->updateOrCreate(
                ['key' => $row['key']],
                $row,
            );
        }
    }
}
