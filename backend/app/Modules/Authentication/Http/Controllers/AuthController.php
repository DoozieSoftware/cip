<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Controllers;

use App\Modules\Authentication\Http\Requests\SendOtpRequest;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;

/**
 * Auth-facing endpoints.
 *
 *  - POST /api/v1/auth/send-otp   (this milestone)
 *  - POST /api/v1/auth/verify-otp (T-M2-014)
 *  - POST /api/v1/auth/refresh    (T-M2-015)
 *  - POST /api/v1/auth/logout     (T-M2-016)
 *  - GET  /api/v1/auth/me         (T-M2-017)
 *
 * Per docs/05 §5 and docs/11 §6. No business logic lives here — all
 * flows go through the relevant service.
 */
class AuthController extends BaseController
{
    public function __construct(
        private readonly OtpService $otpService,
    ) {}

    /**
     * POST /api/v1/auth/send-otp
     *
     * Validates the mobile, calls OtpService::request, and returns
     * `{ otp_sent: true }` on success. The plaintext OTP is NEVER
     * returned in the response — it is delivered via the SMS gateway
     * (or log channel in V1 / tests).
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

        return $this->respond(['otp_sent' => true]);
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
        } catch (\Throwable) {
            // Audit must not break the user-facing flow. Swallow.
        }
    }
}
