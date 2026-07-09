<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Database\Migrations\Migration;

/**
 * PILOT ONLY — raise the per-mobile/per-IP OTP request cap.
 *
 * The `ratelimit.otp_per_hour` security policy defaults to 5/hour, which
 * is too low for pilot testing where the OTP is returned in the
 * /auth/send-otp response (CIP_DEBUG_OTP=true, log SMS driver). The
 * runtime value is read from the DB row (SecurityPolicyService), and the
 * deploy does not run seeders, so we bump the row here.
 *
 * TODO(security): revert to 5 before public launch — see task
 * "Revert OTP rate-limit to 5/hour before go-live".
 */
return new class extends Migration
{
    private const PILOT_CAP = 1000;

    public function up(): void
    {
        SecurityPolicy::query()->updateOrCreate(
            ['key' => 'ratelimit.otp_per_hour'],
            [
                'value' => ['per_hour' => self::PILOT_CAP],
                'type' => 'array',
                'description' => 'Maximum OTP requests per phone per hour. Raised for pilot; revert to 5 before go-live.',
            ],
        );
    }

    public function down(): void
    {
        SecurityPolicy::query()->updateOrCreate(
            ['key' => 'ratelimit.otp_per_hour'],
            [
                'value' => ['per_hour' => 5],
                'type' => 'array',
                'description' => 'Maximum OTP requests per phone per hour.',
            ],
        );
    }
};
