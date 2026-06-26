<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\Otp;
use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;

/**
 * Feature coverage for the refresh-token rotation contract. Per
 * docs/11 §7 (Session Security) and the M2 happy path, every
 * refresh call must:
 *  - return a fresh access token + refresh token pair
 *  - revoke the parent refresh token (single-use)
 *  - reject a second use of the same parent (replay protection)
 *  - emit a `REFRESH_TOKEN_REPLAY` security event on replay
 *  - terminate the entire rotation chain on replay
 */
beforeEach(function (): void {
    // Use a closure-based OtpService so the test can capture the
    // plain code (it is never persisted — only its bcrypt hash is).
    $captured = null;
    $this->otpService = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $this->otpService);
    $this->capturedMessage = &$captured;

    $this->auth = app(AuthenticationService::class);
    $this->mobile = '9876543210';

    // Seed the baseline roles — verify-otp assigns the `citizen`
    // role on first contact and the role must exist.
    (new RolesAndPermissionsSeeder)->run();
});

function refreshIssueCode($self): string
{
    $self->otpService->request($self->mobile, '10.0.0.1', 'Pest/Test');
    preg_match('/verification code is (\d{6})/', $self->capturedMessage, $m);
    expect($m[1] ?? null)->not->toBeNull('OTP message must contain the code');

    return $m[1];
}

it('issues a refresh token on verify-otp and returns it exactly once', function (): void {
    $code = refreshIssueCode($this);

    $result = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');

    expect($result)->toHaveKeys(['access_token', 'token', 'refresh']);
    expect($result['refresh']['plain'])->toBeString()->toHaveLength(64);

    $user = User::query()->where('mobile', $this->mobile)->firstOrFail();
    expect($user->refreshTokens()->whereNull('revoked_at')->count())->toBe(1);
});

it('rotates a refresh token — old becomes revoked, new is active', function (): void {
    $code = refreshIssueCode($this);
    $issued = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');
    $oldPlain = $issued['refresh']['plain'];

    $resp = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $oldPlain]);
    $resp->assertOk()->assertJsonPath('success', true);

    $data = $resp->json('data');
    expect($data['refresh_token'])->toBeString()->not->toBe($oldPlain);

    $user = User::query()->where('mobile', $this->mobile)->firstOrFail();
    $rows = $user->refreshTokens()->orderBy('created_at')->get();

    expect($rows)->toHaveCount(2)
        ->and($rows[0]->revoked_at)->not->toBeNull()
        ->and($rows[1]->revoked_at)->toBeNull()
        ->and($rows[1]->parent_id)->toBe($rows[0]->id);
});

it('rejects a second use of the same refresh token with 401', function (): void {
    $code = refreshIssueCode($this);
    $issued = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');
    $plain = $issued['refresh']['plain'];

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $plain])->assertOk();

    $resp = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $plain]);
    $resp->assertStatus(401)->assertJsonPath('code', 'REFRESH_TOKEN_REPLAY');
});

it('emits a REFRESH_TOKEN_REPLAY security event on a second use of the same token', function (): void {
    $code = refreshIssueCode($this);
    $issued = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');
    $plain = $issued['refresh']['plain'];

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $plain])->assertOk();
    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $plain])->assertStatus(401);

    $user = User::query()->where('mobile', $this->mobile)->firstOrFail();
    $events = SecurityEvent::query()
        ->where('event', 'REFRESH_TOKEN_REPLAY')
        ->where('user_id', $user->id)
        ->get();

    expect($events)->toHaveCount(1)
        ->and($events[0]->severity)->toBe('critical')
        ->and($events[0]->metadata)->toHaveKey('token_id')
        ->and($events[0]->metadata)->toHaveKey('ip');
});

it('terminates the entire rotation chain on a replay', function (): void {
    $code = refreshIssueCode($this);
    $issued = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');
    $firstPlain = $issued['refresh']['plain'];

    // Build a 3-token chain.
    $r1Plain = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $firstPlain])
        ->json('data.refresh_token');
    $r2Plain = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $r1Plain])
        ->json('data.refresh_token');

    // Replay the first token.
    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $firstPlain])->assertStatus(401);

    $user = User::query()->where('mobile', $this->mobile)->firstOrFail();
    $rows = $user->refreshTokens()->orderBy('created_at')->get();

    expect($rows)->toHaveCount(3)
        ->and($rows->whereNull('revoked_at'))->toHaveCount(0);
});

it('rejects an unknown refresh token with 401', function (): void {
    $resp = $this->postJson('/api/v1/auth/refresh', [
        'refresh_token' => str_repeat('a', 64),
    ]);

    $resp->assertStatus(401)
        ->assertJsonPath('code', 'REFRESH_TOKEN_INVALID');
});

it('rejects a malformed body with 422', function (): void {
    $resp = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => 'short']);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');
});

it('returns a fresh Sanctum access token on every rotation', function (): void {
    $code = refreshIssueCode($this);
    $issued = $this->auth->verifyOtp($this->mobile, $code, '10.0.0.1', 'Pest/Test');
    $first = $issued['access_token'];
    $plain = $issued['refresh']['plain'];

    $r1 = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $plain]);
    $r1->assertOk();

    expect($r1->json('data.token.access_token'))->toBeString()->not->toBe($first);
});
