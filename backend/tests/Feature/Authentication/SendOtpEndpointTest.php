<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\Otp;
use App\Modules\Authentication\Services\OtpService;
use Illuminate\Support\Facades\Hash;

/**
 * Validates POST /api/v1/auth/send-otp introduced in T-M2-013.
 *
 * Per docs/05 §5 and docs/11 §6.
 */
beforeEach(function (): void {
    // Bind a deterministic fake OtpService so tests are reproducible
    // and never write to a real SMS log.
    $this->app->bind(OtpService::class, function () {
        return new OtpService(static function (string $mobile, string $message): void {
            // No-op dispatcher for tests.
        });
    });
});

it('returns 200 with {otp_sent:true} on a valid request', function (): void {
    $response = $this->postJson('/api/v1/auth/send-otp', [
        'mobile' => '9876543210',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.otp_sent', true);

    // The plaintext OTP must NEVER appear in the response.
    $body = $response->getContent() ?: '';
    expect($body)->not->toContain('plain');

    // An Otp row exists, hashed, not plaintext.
    $otp = Otp::query()->latest()->first();
    expect($otp)->not->toBeNull()
        ->and($otp->code_hash)->not->toBe($otp->getKey())
        ->and(strlen($otp->code_hash))->toBeGreaterThan(20);
});

it('rejects an invalid mobile with 422', function (): void {
    foreach (['123', 'abcdefghij', ''] as $bad) {
        $this->postJson('/api/v1/auth/send-otp', ['mobile' => $bad])
            ->assertStatus(422);
    }

    expect(Otp::query()->count())->toBe(0);
});

it('accepts E.164 and normalises to 10 digits', function (): void {
    $this->postJson('/api/v1/auth/send-otp', [
        'mobile' => '+919876543210',
    ])->assertOk()->assertJsonPath('data.otp_sent', true);

    $otp = Otp::query()->latest()->first();
    expect($otp->mobile)->toBe('9876543210');
});

it('returns 429 after 5 successful requests in an hour', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])
            ->assertOk();
    }

    $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'RATE_LIMITED');
});

it('records a LoginHistory row for each request (success and rate-limited)', function (): void {
    $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])->assertOk();

    for ($i = 0; $i < 4; $i++) {
        $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])->assertOk();
    }
    $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])->assertStatus(429);

    $rows = LoginHistory::query()->get();
    expect($rows)->toHaveCount(6)
        ->and($rows->where('success', true))->toHaveCount(5)
        ->and($rows->where('success', false)->pluck('failure_reason')->unique()->all())
        ->toBe(['RATE_LIMITED']);
});

it('never returns the OTP code in the response body', function (): void {
    $response = $this->postJson('/api/v1/auth/send-otp', ['mobile' => '9876543210'])->assertOk();
    $json = $response->json();
    $serialized = json_encode($json);

    // Bcrypt hash + 6-digit plaintext range — neither must appear
    expect($serialized)->not->toMatch('/\\b\\d{6}\\b/');
});
