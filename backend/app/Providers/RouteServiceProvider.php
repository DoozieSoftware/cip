<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * Route service provider.
 *
 * Centralises the registration of named rate limiters that are
 * referenced from routes via `throttle:<name>`. Per docs/11 §21
 * (Rate Limiting), every limiter name maps to a `Limit` object
 * whose keying strategy depends on the actor:
 *
 *  - otp         : keyed by IP only (no actor before authentication)
 *  - citizen     : keyed by user id when authenticated, IP otherwise
 *  - uploads     : keyed by user id
 *  - moderator   : keyed by user id
 *  - department  : keyed by user id
 *  - admin       : keyed by user id
 *
 * The numbers are the V1 baseline. Per the spec they are
 * "configurable" — a future M3 task will move these into the
 * `settings` table and resolve through `config('rate_limits.*')`.
 */
class RouteServiceProvider extends ServiceProvider
{
    public const LIMITER_OTP = 'otp';

    public const LIMITER_CITIZEN = 'citizen';

    public const LIMITER_UPLOADS = 'uploads';

    public const LIMITER_MODERATOR = 'moderator';

    public const LIMITER_DEPARTMENT = 'department';

    public const LIMITER_ADMIN = 'admin';

    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    public function register(): void
    {
        // No bindings to register; the provider is boot-only.
    }

    /**
     * Coerce the request IP into a string, falling back to a sentinel
     * value if the framework returns null (no REMOTE_ADDR). The Limit
     * key must be a string.
     */
    private function ipKey(Request $request): string
    {
        $ip = $request->ip();

        return is_string($ip) && $ip !== '' ? $ip : '0.0.0.0';
    }

    /**
     * Coerce a user key (string|int|null) into a string. Null falls
     * back to the IP key.
     */
    private function userKey(Request $request): string
    {
        $key = $request->user()?->getKey();

        if (is_string($key) && $key !== '') {
            return $key;
        }

        if (is_int($key)) {
            return (string) $key;
        }

        return $this->ipKey($request);
    }

    private function configureRateLimiting(): void
    {
        // 5 requests / hour / IP — keyed by IP because the actor is
        // pre-authentication (the mobile is the only signal).
        RateLimiter::for(self::LIMITER_OTP, function (Request $request): array {
            return [
                Limit::perHour(5)->by('otp:'.$this->ipKey($request)),
            ];
        });

        // 60 requests / minute — keyed by user id when authenticated,
        // IP otherwise. Mixed keying keeps a single device / single
        // account honest.
        RateLimiter::for(self::LIMITER_CITIZEN, function (Request $request): array {
            return [
                Limit::perMinute(60)->by('citizen:'.$this->userKey($request)),
            ];
        });

        // 100 MB / hour / user — the byte-counting limit guards the
        // media pipeline. The default `throttle` middleware counts
        // requests, not bytes, so the byte cap is enforced by the
        // upload service itself (T-M5-xxx); the named limiter here
        // is the request-count cap.
        RateLimiter::for(self::LIMITER_UPLOADS, function (Request $request): array {
            return [
                Limit::perHour(120)->by('uploads:'.$this->userKey($request)),
            ];
        });

        // 300 requests / minute / user — staff endpoints are
        // higher-throughput than citizen endpoints.
        RateLimiter::for(self::LIMITER_MODERATOR, function (Request $request): array {
            return [
                Limit::perMinute(300)->by('mod:'.$this->userKey($request)),
            ];
        });

        // 300 requests / minute / user — department endpoints.
        RateLimiter::for(self::LIMITER_DEPARTMENT, function (Request $request): array {
            return [
                Limit::perMinute(300)->by('dept:'.$this->userKey($request)),
            ];
        });

        // 600 requests / minute / user — admin endpoints, higher
        // cap because admin tools do batch work.
        RateLimiter::for(self::LIMITER_ADMIN, function (Request $request): array {
            return [
                Limit::perMinute(600)->by('admin:'.$this->userKey($request)),
            ];
        });
    }
}
