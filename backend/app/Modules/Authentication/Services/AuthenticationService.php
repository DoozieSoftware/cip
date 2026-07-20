<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Services;

use App\Modules\Authentication\Events\UserAuthenticated;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\Otp;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Security\Services\SecurityPolicyService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\NewAccessToken;

/**
 * End-to-end authentication flows.
 *
 *  - `verifyOtp()` — citizen OTP login: find or create the user, mark
 *    the OTP consumed, issue a Sanctum PAT + a refresh token, write a
 *    login_history row, and emit `UserAuthenticated`.
 *
 *  - `refresh()` — refresh-token rotation: see RefreshTokenService.
 *  - `logout()` — revoke the current Sanctum PAT and all refresh
 *    tokens belonging to the user.
 *
 * Per docs/03 §13-14 (auth, authz), docs/05 §5, docs/11 §6-7.
 */
class AuthenticationService extends BaseService
{
    private const MAX_FAILED_LOGIN_ATTEMPTS = 5;

    private const LOGIN_LOCKOUT_WINDOW_MINUTES = 15;

    public function __construct(
        private readonly OtpService $otpService,
        private readonly RefreshTokenService $refreshTokens,
        private readonly SecurityEventService $securityEvents,
    ) {}

    /**
     * @return array{token: NewAccessToken, refresh: array{token: RefreshToken, plain: string, expires_at: Carbon}, user: User, access_token: string}
     *
     * @throws ApiException 401 on bad/expired/exhausted code
     */
    public function verifyOtp(string $mobile, string $code, ?string $ip = null, ?string $userAgent = null, ?string $deviceFingerprint = null): array
    {
        $otp = $this->otpService->verify($mobile, $code);

        $user = DB::transaction(function () use ($mobile, $ip): User {
            $user = User::query()->where('mobile', $mobile)->first();

            if ($user === null) {
                // First contact for this mobile — create the citizen and
                // mark them OTP-verified. Name is set later via the
                // PWA profile flow (T-M13-xxx).
                $user = new User;
                $user->mobile = $mobile;
                $user->anonymous_enabled = false;
                $user->status = 'active';
                $user->otp_verified_at = now();
                $user->save();
            } else {
                $user->otp_verified_at = now();
                $user->save();
            }

            $user->recordLogin($ip ?? '0.0.0.0');

            return $user;
        });

        // The citizen role is assigned on first contact and never
        // removed. Additional staff roles are added by the
        // super-admin portal (T-M12-xxx).
        if (! $user->hasRole('citizen')) {
            $user->assignRole('citizen');
        }

        $token = $user->createToken(
            name: 'citizen-otp',
            abilities: ['*'],
            expiresAt: $this->accessTokenExpiry(),
        );

        $refresh = $this->refreshTokens->issue($user, $ip, $userAgent);

        $this->recordLoginHistory($user, $mobile, $ip, $userAgent, $deviceFingerprint, success: true);

        UserAuthenticated::dispatch($user, 'otp', [
            'ip' => $ip,
            'user_agent' => $userAgent,
            'device_fingerprint' => $deviceFingerprint,
        ]);

        return [
            'token' => $token,
            'access_token' => $token->plainTextToken,
            'refresh' => $refresh,
            'user' => $user,
        ];
    }

    /**
     * Staff password login (docs/11 §8). Citizens have no `password`
     * set and always authenticate through `verifyOtp()` instead — a
     * null password column makes this endpoint a guaranteed 401 for
     * them, never a hint that the mobile exists.
     *
     * Emits `LOGIN_SUCCESS` / `LOGIN_FAILURE` security events (the
     * two of the six documented events that were never wired to any
     * code path before this method existed) and enforces a rolling
     * lockout after 5 failed attempts in 15 minutes.
     *
     * @return array{token: NewAccessToken, refresh: array{token: RefreshToken, plain: string, expires_at: Carbon}, user: User, access_token: string}
     *
     * @throws ApiException 401 on bad credentials, 429 when locked out
     */
    public function loginWithPassword(string $mobile, string $password, ?string $ip = null, ?string $userAgent = null): array
    {
        $this->assertNotLockedOut($mobile);

        $user = User::query()->where('mobile', $mobile)->first();

        if ($user === null || $user->password === null || ! Hash::check($password, $user->password)) {
            $this->recordLoginAttempt($user, $mobile, $ip, $userAgent, success: false, reason: 'invalid_credentials');
            $this->securityEvents->recordSafe(
                'LOGIN_FAILURE',
                SecurityEventService::SEVERITY_WARNING,
                ['mobile' => $mobile, 'ip' => $ip],
                $user,
            );

            throw ApiException::unauthorized('Invalid mobile or password.');
        }

        $user->recordLogin($ip ?? '0.0.0.0');

        $token = $user->createToken(
            name: 'staff-password',
            abilities: ['*'],
            expiresAt: $this->accessTokenExpiry(),
        );

        $refresh = $this->refreshTokens->issue($user, $ip, $userAgent);

        $this->recordLoginAttempt($user, $mobile, $ip, $userAgent, success: true, reason: null);
        $this->securityEvents->recordSafe(
            'LOGIN_SUCCESS',
            SecurityEventService::SEVERITY_INFO,
            ['mobile' => $mobile, 'ip' => $ip],
            $user,
        );

        UserAuthenticated::dispatch($user, 'password', [
            'ip' => $ip,
            'user_agent' => $userAgent,
        ]);

        return [
            'token' => $token,
            'access_token' => $token->plainTextToken,
            'refresh' => $refresh,
            'user' => $user,
        ];
    }

    /**
     * Rotate a refresh token and issue a new Sanctum PAT. The old
     * refresh token is revoked as part of the rotation (see
     * RefreshTokenService::rotate). Reuse of a revoked parent is
     * detected and the entire chain is killed.
     *
     * @return array{token: NewAccessToken, access_token: string, refresh: array{token: RefreshToken, plain: string, expires_at: CarbonInterface}, user: User}
     *
     * @throws ApiException 401 on bad / expired / reused token
     */
    public function refresh(string $plainRefreshToken, ?string $ip = null, ?string $userAgent = null): array
    {
        $rotated = $this->refreshTokens->rotate($plainRefreshToken, $ip, $userAgent);
        $user = $rotated['user'];

        $token = $user->createToken(
            name: 'refresh',
            abilities: ['*'],
            expiresAt: $this->accessTokenExpiry(),
        );

        return [
            'token' => $token,
            'access_token' => $token->plainTextToken,
            'refresh' => $rotated,
            'user' => $user,
        ];
    }

    /**
     * Logout: revoke the current Sanctum PAT and every active refresh
     * token for the user.
     */
    public function logout(User $user, ?string $currentAccessTokenId = null): void
    {
        if ($currentAccessTokenId !== null) {
            $user->tokens()->where('id', $currentAccessTokenId)->delete();
        } else {
            $token = $user->currentAccessToken();

            if ($token !== null) {
                $token->delete();
            }
        }

        $this->refreshTokens->revokeAllForUser($user);
    }

    /**
     * Access token lifetime comes from the `jwt.access_ttl_minutes`
     * security policy (docs/11 §8). Missing/unmigrated policy falls
     * back to the service default so token issuance still works.
     */
    private function accessTokenExpiry(): \DateTimeInterface
    {
        return now()->addMinutes(app(SecurityPolicyService::class)->jwtAccessTtlMinutes());
    }

    private function recordLoginHistory(User $user, string $mobile, ?string $ip, ?string $userAgent, ?string $fingerprint, bool $success, ?string $reason = null): void
    {
        try {
            LoginHistory::query()->create([
                'user_id' => $user->id,
                'mobile' => $mobile,
                'ip' => $ip,
                'user_agent' => $userAgent,
                'device_fingerprint' => $fingerprint,
                'success' => $success,
                'failure_reason' => $reason,
                'login_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Audit must not break the user-facing flow, but a silently
            // dropped login row blinds the failed-attempt lockout and
            // security review, so surface it in the logs.
            Log::warning('login_history.write_failed', [
                'user_id' => $user->id,
                'success' => $success,
                'reason' => $reason,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Same as `recordLoginHistory()` but tolerates a null user — the
     * password-login flow logs a failed attempt even when the mobile
     * doesn't match any account, so a brute-force sweep is visible
     * without leaking which mobiles are registered.
     */
    private function recordLoginAttempt(?User $user, string $mobile, ?string $ip, ?string $userAgent, bool $success, ?string $reason): void
    {
        try {
            LoginHistory::query()->create([
                'user_id' => $user?->id,
                'mobile' => $mobile,
                'ip' => $ip,
                'user_agent' => $userAgent,
                'device_fingerprint' => null,
                'success' => $success,
                'failure_reason' => $reason,
                'login_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Audit must not break the user-facing flow, but a silently
            // dropped login row blinds the failed-attempt lockout and
            // security review, so surface it in the logs.
            Log::warning('login_history.write_failed', [
                'user_id' => $user?->id,
                'success' => $success,
                'reason' => $reason,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Throws ApiException(429) after 5 failed password-login attempts
     * for the same mobile within a rolling 15-minute window — mirrors
     * OtpService's rate-limit-by-count-query pattern.
     */
    private function assertNotLockedOut(string $mobile): void
    {
        $recentFailures = LoginHistory::query()
            ->where('mobile', $mobile)
            ->where('success', false)
            ->where('login_at', '>=', now()->subMinutes(self::LOGIN_LOCKOUT_WINDOW_MINUTES))
            ->count();

        if ($recentFailures >= self::MAX_FAILED_LOGIN_ATTEMPTS) {
            throw ApiException::rateLimited('Too many failed login attempts. Please try again later.');
        }
    }
}
