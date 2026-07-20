<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Controllers;

use App\Modules\Authentication\Http\Requests\LoginRequest;
use App\Modules\Authentication\Http\Requests\RefreshTokenRequest;
use App\Modules\Authentication\Http\Requests\SendOtpRequest;
use App\Modules\Authentication\Http\Requests\VerifyOtpRequest;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Auth-facing endpoints.
 *
 *  - POST /api/v1/auth/send-otp   (T-M2-013)
 *  - POST /api/v1/auth/verify-otp (T-M2-014)
 *  - POST /api/v1/auth/login      (staff password login, docs/11 §8)
 *  - POST /api/v1/auth/refresh    (T-M2-015)
 *  - POST /api/v1/auth/logout     (T-M2-016)
 *  - GET  /api/v1/auth/me         (T-M2-017)

 *
 * Per docs/05 §5 and docs/11 §6-7. No business logic lives here — all
 * flows go through the relevant service.
 */
class AuthController extends BaseController
{
    public function __construct(
        private readonly OtpService $otpService,
        private readonly AuthenticationService $auth,
    ) {}

    /**
     * POST /api/v1/auth/send-otp
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $mobile = $request->mobile();
        $ip = $request->ip();
        $userAgent = $request->userAgent();

        try {
            $this->otpService->request($mobile, $ip, $userAgent);
        } catch (ApiException $e) {
            $this->recordAttempt($mobile, $ip, $userAgent, success: false, reason: $e->errorCode);

            return $this->respondError($e->getMessage(), $e->httpStatus, $e->errorCode);
        }

        $this->recordAttempt($mobile, $ip, $userAgent, success: true, reason: null);

        $payload = ['otp_sent' => true];

        if (app()->environment('local') || config('cip.auth.debug_otp', false)) {
            $payload['debug_otp'] = $this->otpService->latestCodeFor($mobile);
            $expiryMinutes = config('cip.auth.otp_expiry_minutes', 5);
            $payload['expires_in'] = (is_numeric($expiryMinutes) ? (int) $expiryMinutes : 5) * 60;
        }

        return $this->respond($payload);
    }

    /**
     * POST /api/v1/auth/verify-otp
     *
     * Returns the Sanctum access token (string), the refresh token
     * (opaque plaintext — only chance to capture it), the user via
     * UserResource, and the refresh expiry. The plaintext access
     * token is `access_token` in the response so the client can
     * stash it directly; the `token` key carries the NewAccessToken
     * metadata for callers that want the id/expires_at.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        $mobile = $request->mobile();
        $code = $request->code();
        $ip = $request->ip();
        $userAgent = $request->userAgent();

        try {
            $result = $this->auth->verifyOtp($mobile, $code, $ip, $userAgent);
        } catch (ApiException $e) {
            $this->recordAttempt($mobile, $ip, $userAgent, success: false, reason: $e->errorCode);

            return $this->respondError($e->getMessage(), $e->httpStatus, $e->errorCode);
        }

        return $this->respond([
            'token' => [
                'access_token' => $result['access_token'],
                'type' => 'Bearer',
                'expires_at' => $result['token']->accessToken->expires_at?->toIso8601String(),
            ],
            'refresh_token' => $result['refresh']['plain'],
            'refresh_expires_at' => $result['refresh']['expires_at']->toIso8601String(),
            'user' => (new UserResource($result['user']->load(['roles', 'departments'])))->toArray($request),
        ]);
    }

    /**
     * POST /api/v1/auth/login — staff password login (docs/11 §8).
     * Citizens have no password set and always 401 here; they
     * authenticate via `verifyOtp()` instead.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->auth->loginWithPassword(
                $request->mobile(),
                $request->password(),
                $request->ip(),
                $request->userAgent(),
            );
        } catch (ApiException $e) {
            return $this->respondError($e->getMessage(), $e->httpStatus, $e->errorCode);
        }

        return $this->respond([
            'token' => [
                'access_token' => $result['access_token'],
                'type' => 'Bearer',
                'expires_at' => $result['token']->accessToken->expires_at?->toIso8601String(),
            ],
            'refresh_token' => $result['refresh']['plain'],
            'refresh_expires_at' => $result['refresh']['expires_at']->toIso8601String(),
            'user' => (new UserResource($result['user']->load(['roles', 'departments'])))->toArray($request),
        ]);
    }

    /**
     * POST /api/v1/auth/refresh
     */
    public function refresh(RefreshTokenRequest $request): JsonResponse
    {
        try {
            $result = $this->auth->refresh(
                $request->refreshToken(),
                $request->ip(),
                $request->userAgent(),
            );
        } catch (ApiException $e) {
            return $this->respondError($e->getMessage(), $e->httpStatus, $e->errorCode);
        }

        return $this->respond([
            'token' => [
                'access_token' => $result['access_token'],
                'type' => 'Bearer',
                'expires_at' => $result['token']->accessToken->expires_at?->toIso8601String(),
            ],
            'refresh_token' => $result['refresh']['plain'],
            'refresh_expires_at' => $result['refresh']['expires_at']->toIso8601String(),
        ]);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $accessToken = $user->currentAccessToken();
        $accessTokenId = $accessToken->getKey();
        $accessTokenIdString = is_string($accessTokenId) || is_int($accessTokenId) ? (string) $accessTokenId : null;

        $this->auth->logout($user, $accessTokenIdString);

        return $this->respond(['logged_out' => true]);
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        return $this->respond((new UserResource($user->load(['roles', 'departments'])))->toArray($request));
    }

    private function recordAttempt(string $mobile, ?string $ip, ?string $userAgent, bool $success, ?string $reason): void
    {
        try {
            LoginHistory::query()->create([
                'user_id' => null,
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
            // dropped attempt row blinds the failed-attempt lockout and
            // security review, so surface it in the logs.
            Log::warning('login_history.write_failed', [
                'mobile' => $mobile,
                'success' => $success,
                'reason' => $reason,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
