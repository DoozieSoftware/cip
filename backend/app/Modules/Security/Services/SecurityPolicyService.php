<?php

declare(strict_types=1);

namespace App\Modules\Security\Services;

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Validation\Rules\Password;

/**
 * Reads `security_policies` rows and turns them into real validation
 * rules. Before this class existed, the Security Policies admin
 * screen was pure CRUD theater — a Super Admin could edit
 * `password.min_length` and nothing in the codebase would ever read
 * the row back (a Critical finding in the post-audit remediation).
 *
 * `passwordRule()` is the first policy actually wired to runtime
 * behaviour: it backs both staff account creation
 * (`StoreUserRequest`/`UpdateUserRequest`) and is the single source
 * of truth docs/11 §8 describes. OTP expiry / rate-limit policy
 * wiring is a tracked fast-follow, not covered here.
 */
class SecurityPolicyService
{
    public const PASSWORD_POLICY_KEY = 'password.min_length';

    public const OTP_EXPIRY_SECONDS_KEY = 'otp.expiry_seconds';

    public const JWT_ACCESS_TTL_MINUTES_KEY = 'jwt.access_ttl_minutes';

    public const JWT_REFRESH_TTL_DAYS_KEY = 'jwt.refresh_ttl_days';

    public const SESSION_TIMEOUT_MINUTES_KEY = 'session.timeout_minutes';

    public const RATELIMIT_OTP_PER_HOUR_KEY = 'ratelimit.otp_per_hour';

    public const MEDIA_MAX_UPLOAD_MB_KEY = 'media.max_upload_mb';

    public const MEDIA_MAX_VIDEO_SECONDS_KEY = 'media.max_video_seconds';

    public const MEDIA_MAX_PHOTOS_PER_REPORT_KEY = 'media.max_photos_per_report';

    /**
     * Defaults match docs/11 §8 exactly (min 12, upper+lower case,
     * number, special character) — used only when no policy row
     * exists yet (e.g. a fresh install before the seeder runs).
     */
    private const DEFAULT_MIN = 12;

    private const DEFAULT_OTP_EXPIRY_SECONDS = 300;

    private const DEFAULT_JWT_ACCESS_TTL_MINUTES = 60;

    private const DEFAULT_JWT_REFRESH_TTL_DAYS = 14;

    private const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

    private const DEFAULT_RATELIMIT_OTP_PER_HOUR = 5;

    /**
     * Photo upload cap fallback mirrors MediaService::MAX_BYTES['PHOTO']
     * so unconfigured behaviour is unchanged.
     */
    private const DEFAULT_MEDIA_MAX_UPLOAD_MB = 16;

    /**
     * Video duration cap fallback mirrors MediaService::VIDEO_MAX_DURATION.
     */
    private const DEFAULT_MEDIA_MAX_VIDEO_SECONDS = 300;

    private const DEFAULT_MEDIA_MAX_PHOTOS_PER_REPORT = 10;

    public function passwordRule(): Password
    {
        $policy = SecurityPolicy::query()->where('key', self::PASSWORD_POLICY_KEY)->first();
        $value = $policy instanceof SecurityPolicy ? ($policy->value ?? []) : [];

        $min = $value['min'] ?? self::DEFAULT_MIN;
        $rule = Password::min(is_numeric($min) ? (int) $min : self::DEFAULT_MIN);

        if ($value['require_mixed_case'] ?? true) {
            $rule = $rule->mixedCase();
        }

        if ($value['require_number'] ?? true) {
            $rule = $rule->numbers();
        }

        if ($value['require_symbol'] ?? true) {
            $rule = $rule->symbols();
        }

        return $rule;
    }

    public function otpExpirySeconds(): int
    {
        return (int) $this->intValue(self::OTP_EXPIRY_SECONDS_KEY, 'seconds', self::DEFAULT_OTP_EXPIRY_SECONDS);
    }

    public function jwtAccessTtlMinutes(): int
    {
        return (int) $this->intValue(self::JWT_ACCESS_TTL_MINUTES_KEY, 'minutes', self::DEFAULT_JWT_ACCESS_TTL_MINUTES);
    }

    public function jwtRefreshTtlDays(): int
    {
        return (int) $this->intValue(self::JWT_REFRESH_TTL_DAYS_KEY, 'days', self::DEFAULT_JWT_REFRESH_TTL_DAYS);
    }

    public function sessionTimeoutMinutes(): int
    {
        return (int) $this->intValue(self::SESSION_TIMEOUT_MINUTES_KEY, 'minutes', self::DEFAULT_SESSION_TIMEOUT_MINUTES);
    }

    public function rateLimitOtpPerHour(): int
    {
        return (int) $this->intValue(self::RATELIMIT_OTP_PER_HOUR_KEY, 'per_hour', self::DEFAULT_RATELIMIT_OTP_PER_HOUR);
    }

    public function mediaMaxUploadMb(): int
    {
        return (int) $this->intValue(self::MEDIA_MAX_UPLOAD_MB_KEY, 'mb', self::DEFAULT_MEDIA_MAX_UPLOAD_MB);
    }

    public function mediaMaxVideoSeconds(): int
    {
        return (int) $this->intValue(self::MEDIA_MAX_VIDEO_SECONDS_KEY, 'seconds', self::DEFAULT_MEDIA_MAX_VIDEO_SECONDS);
    }

    public function mediaMaxPhotosPerReport(): int
    {
        return (int) $this->intValue(self::MEDIA_MAX_PHOTOS_PER_REPORT_KEY, 'max', self::DEFAULT_MEDIA_MAX_PHOTOS_PER_REPORT);
    }

    /**
     * Read a single numeric sub-value from a security_policies row.
     *
     * Defensive: returns $default when the row is missing, the
     * sub-key is absent, or the table is not yet migrated (so the
     * app boots cleanly during `migrate` / `config:clear`).
     */
    private function intValue(string $key, string $subKey, int $default): int
    {
        try {
            $policy = SecurityPolicy::query()->where('key', $key)->first();
        } catch (\Throwable) {
            return $default;
        }

        if (! $policy instanceof SecurityPolicy) {
            return $default;
        }

        $value = $policy->value ?? [];
        $raw = is_array($value) ? ($value[$subKey] ?? null) : null;

        return is_numeric($raw) ? (int) $raw : $default;
    }
}
