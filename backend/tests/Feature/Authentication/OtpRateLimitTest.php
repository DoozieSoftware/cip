<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\Otp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Shared\Exceptions\ApiException;

uses(RefreshDatabase::class);

/**
 * Validates the rate-limited OTP request flow introduced in T-M2-011.
 *
 * Per docs/11 §21 (Rate Limiting — OTP 5/hour), both per-mobile and
 * per-IP caps are enforced. OTPs are stored as bcrypt hashes; the
 * plaintext is delivered via the dispatch closure.
 */
it('issues an OTP, returns a 6-digit code, and stores only the hash', function (): void {
    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = ['mobile' => $mobile, 'message' => $message];
    });

    $issued = $service->request('9876543210', '10.0.0.1', 'Pest/Test');

    expect($issued['plain'])->toMatch('/^\d{6}$/')
        ->and($issued['otp']->code_hash)->not->toBe($issued['plain'])
        ->and(password_verify($issued['plain'], $issued['otp']->code_hash))->toBeTrue()
        ->and($issued['otp']->attempts)->toBe(0)
        ->and($captured['mobile'])->toBe('9876543210');

    // The dispatched message must include the plaintext code.
    expect($captured['message'])->toContain($issued['plain']);
});

it('rate-limits the 6th request per mobile within an hour', function (): void {
    $service = new OtpService(static fn () => null);

    for ($i = 0; $i < 5; $i++) {
        $service->request('9876543210', '10.0.0.1');
    }

    $service->request('9876543210', '10.0.0.1');
})->throws(ApiException::class, 'Too many OTP requests for this mobile');

it('rate-limits the 6th request per IP within an hour', function (): void {
    $service = new OtpService(static fn () => null);

    // 5 different mobiles, same IP — should hit the per-IP cap
    for ($i = 0; $i < 5; $i++) {
        $service->request('900000000'.$i, '10.0.0.99');
    }

    $service->request('9000000005', '10.0.0.99');
})->throws(ApiException::class, 'Too many OTP requests from this IP');

it('verifies a fresh code, marks the OTP consumed, and rejects re-use', function (): void {
    $service = new OtpService(static fn () => null);
    $issued = $service->request('9876543210', '10.0.0.1');

    $verified = $service->verify('9876543210', $issued['plain']);
    expect($verified->isConsumed())->toBeTrue();

    $service->verify('9876543210', $issued['plain']);
})->throws(ApiException::class);

it('rejects an incorrect code and increments the attempt counter', function (): void {
    $service = new OtpService(static fn () => null);
    $service->request('9876543210', '10.0.0.1');

    try {
        $service->verify('9876543210', '000000');
    } catch (ApiException) {
        // expected
    }

    $latest = Otp::query()->latestFor('9876543210')->first();
    expect($latest->attempts)->toBe(1);
});

it('locks the OTP after 5 failed attempts', function (): void {
    $service = new OtpService(static fn () => null);
    $issued = $service->request('9876543210', '10.0.0.1');

    for ($i = 0; $i < 5; $i++) {
        try {
            $service->verify('9876543210', '000000');
        } catch (ApiException) {
            // expected
        }
    }

    // Even the correct code is now rejected.
    $service->verify('9876543210', $issued['plain']);
})->throws(ApiException::class);

it('respects the configurable expiry window', function (): void {
    config(['cip.auth.otp_expiry_minutes' => 1]);
    $service = new OtpService(static fn () => null);
    $issued = $service->request('9876543210');

    $expected = now()->addMinute();
    $delta = abs($issued['expires_at']->diffInSeconds($expected));
    expect($delta)->toBeLessThan(5);
});

it('uses the default log dispatcher when no closure is provided', function (): void {
    $service = new OtpService;
    $issued = $service->request('9876543210');

    // No exception — the log channel absorbed the message.
    expect($issued['plain'])->toMatch('/^\d{6}$/');
});
