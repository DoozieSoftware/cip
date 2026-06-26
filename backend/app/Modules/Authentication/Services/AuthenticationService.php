<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Services;

use App\Modules\Authentication\Events\UserAuthenticated;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\Otp;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
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
    public function __construct(
        private readonly OtpService $otpService,
        private readonly RefreshTokenService $refreshTokens,
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
        } catch (\Throwable) {
            // Audit must not break the user-facing flow. Swallow.
        }
    }
}
