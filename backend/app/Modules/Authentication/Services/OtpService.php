<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Services;

use App\Modules\Authentication\Models\Otp;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * OTP issuance and verification with rate limiting.
 *
 * Per docs/11 §6 (citizen OTP) and §21 (Rate Limiting — OTP 5/hour):
 *   - At most 5 OTPs may be requested per mobile per rolling hour.
 *   - At most 5 OTPs may be requested per IP per rolling hour.
 *   - OTPs are stored as bcrypt hashes; the plaintext is delivered
 *     through the dispatcher closure (default: log channel; swappable
 *     for an SMS gateway in T-M2-012) and is never persisted.
 *   - Default expiry: 5 minutes (configurable).
 *
 * `verify(mobile, code)` increments the OTP's attempt counter on every
 * call (success or failure) and refuses further attempts once the
 * counter reaches 5.
 */
class OtpService extends BaseService
{
    private const MAX_ATTEMPTS = 5;

    /**
     * In-memory cache of the most-recently-issued plaintext code per
     * mobile. Used by the demo `/auth/send-otp` response so the
     * Citizen PWA can sign in without an SMS gateway. Only populated
     * in `local` / `testing` environments.
     *
     * @var array<string, string>
     */
    private array $latestPlain = [];

    private const MAX_REQUESTS_PER_HOUR = 5;

    /**
     * Default SMS dispatcher — writes the OTP to the `sms` log channel
     * so V1 environments (and tests) can verify the delivered code
     * without an external gateway. T-M2-012 will replace this with a
     * real SmsGatewayInterface binding.
     *
     * @var Closure(string, string): void
     */
    private Closure $dispatcher;

    public function __construct(?Closure $dispatcher = null)
    {
        $this->dispatcher = $dispatcher ?? static function (string $mobile, string $message): void {
            Log::channel('sms')->info($message, ['mobile' => $mobile]);
        };
    }

    /**
     * Override the SMS dispatcher. Used by the container binding for
     * the real gateway and by tests.
     */
    public function setDispatcher(Closure $dispatcher): void
    {
        $this->dispatcher = $dispatcher;
    }

    /**
     * Request a new OTP for the given mobile.
     *
     * @return array{otp: Otp, plain: string, expires_at: Carbon}
     *
     * @throws ApiException 429 if the rate limit is hit
     */
    public function request(string $mobile, ?string $ip = null, ?string $userAgent = null): array
    {
        $this->assertWithinRateLimit($mobile, $ip);

        $plain = $this->generateCode();
        $hash = password_hash($plain, PASSWORD_BCRYPT);
        $rawExpiry = config('cip.auth.otp_expiry_minutes', 5);
        $expiryMinutes = is_numeric($rawExpiry) ? (int) $rawExpiry : 5;

        $otp = new Otp([
            'mobile' => $mobile,
            'code_hash' => $hash,
            'expires_at' => now()->addMinutes($expiryMinutes),
            'attempts' => 0,
            'ip' => $ip,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
        $otp->save();

        ($this->dispatcher)(
            $mobile,
            sprintf('Your Civic Intelligence Platform verification code is %s. It expires in %d minutes.', $plain, $expiryMinutes),
        );

        $this->latestPlain[$mobile] = $plain;

        return [
            'otp' => $otp,
            'plain' => $plain,
            'expires_at' => $otp->expires_at,
        ];
    }

    /**
     * Return the most-recently-issued plaintext code for the given
     * mobile. Returns `null` outside dev / testing environments.
     */
    public function latestCodeFor(string $mobile): ?string
    {
        if (! app()->environment(['local', 'testing']) && ! config('cip.auth.debug_otp', false)) {
            return null;
        }

        return $this->latestPlain[$mobile] ?? null;
    }

    /**
     * Verify a presented code against the latest usable OTP for the
     * mobile. Marks the OTP consumed on success.
     *
     * @throws ApiException 401 on bad code / expired / exhausted
     */
    public function verify(string $mobile, string $code): Otp
    {
        $latest = Otp::query()
            ->latestFor($mobile)
            ->first();

        if ($latest === null) {
            throw ApiException::unauthorized('No OTP has been issued for this mobile.');
        }

        if (! $latest->isUsable()) {
            if ($latest->isExpired()) {
                throw ApiException::unauthorized('OTP has expired. Please request a new one.');
            }

            if ($latest->isConsumed()) {
                throw ApiException::unauthorized('OTP has already been used.');
            }

            throw ApiException::unauthorized('OTP attempts exhausted. Please request a new one.');
        }

        $attempts = $latest->incrementAttempts();

        if (! password_verify($code, $latest->code_hash)) {
            if ($attempts >= self::MAX_ATTEMPTS) {
                $latest->markConsumed();
            }

            throw ApiException::unauthorized('Invalid OTP code.');
        }

        $latest->markConsumed();

        return $latest;
    }

    /**
     * Throws ApiException(429) if the per-mobile or per-IP rate limit
     * would be exceeded by this request.
     */
    private function assertWithinRateLimit(string $mobile, ?string $ip): void
    {
        $hourAgo = now()->subHour();

        $perMobile = Otp::query()
            ->where('mobile', $mobile)
            ->where('created_at', '>=', $hourAgo)
            ->count();

        if ($perMobile >= self::MAX_REQUESTS_PER_HOUR) {
            throw ApiException::rateLimited('Too many OTP requests for this mobile. Please try again later.');
        }

        if ($ip !== null) {
            $perIp = Otp::query()
                ->where('ip', $ip)
                ->where('created_at', '>=', $hourAgo)
                ->count();

            if ($perIp >= self::MAX_REQUESTS_PER_HOUR) {
                throw ApiException::rateLimited('Too many OTP requests from this IP. Please try again later.');
            }
        }
    }

    /**
     * Six-digit numeric OTP, zero-padded.
     */
    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
