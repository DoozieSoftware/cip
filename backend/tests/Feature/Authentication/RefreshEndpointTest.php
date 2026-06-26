<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;

/**
 * Validates POST /api/v1/auth/refresh introduced in T-M2-015.
 *
 * Per docs/05 §5 (Refresh) and docs/11 §7 (Refresh Token Rotation).
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

/**
 * Helper — go through the full verify-otp flow to obtain a
 * refresh_token that the test can present to /auth/refresh.
 */
function obtainRefreshToken(): string
{
    $service = app(AuthenticationService::class);

    $captured = null;
    $otpService = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    app()->instance(OtpService::class, $otpService);
    $otpService->request('9876543210', '127.0.0.1');

    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $result = $service->verifyOtp('9876543210', $code, '127.0.0.1');

    return $result['refresh']['plain'];
}

it('returns a new token + refresh_token pair on a valid refresh', function (): void {
    $old = obtainRefreshToken();

    $response = $this->postJson('/api/v1/auth/refresh', [
        'refresh_token' => $old,
    ]);

    $response->assertOk()->assertJsonStructure([
        'data' => [
            'token' => ['access_token', 'type', 'expires_at'],
            'refresh_token',
            'refresh_expires_at',
        ],
    ]);

    $new = $response->json('data.refresh_token');
    expect($new)->toBeString()->toHaveLength(64)
        ->and($new)->not->toBe($old);
});

it('rejects a second use of the same refresh token (rotation invariant)', function (): void {
    $old = obtainRefreshToken();

    $first = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $old]);
    $first->assertOk();

    $second = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $old]);
    $second->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});

it('rejects an unknown refresh token with 401', function (): void {
    $this->postJson('/api/v1/auth/refresh', [
        'refresh_token' => str_repeat('a', 64),
    ])->assertStatus(401);
});

it('rejects a malformed body with 422', function (): void {
    $this->postJson('/api/v1/auth/refresh', [])->assertStatus(422);
    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => 'short'])->assertStatus(422);
});

it('rotates the underlying refresh_tokens row — old is revoked, new has parent_id', function (): void {
    $oldPlain = obtainRefreshToken();
    $user = User::query()->where('mobile', '9876543210')->first();
    $oldToken = RefreshToken::query()
        ->where('user_id', $user->id)
        ->whereNull('revoked_at')
        ->first();
    expect($oldToken)->not->toBeNull();
    $oldId = $oldToken->id;

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $oldPlain])
        ->assertOk();

    $oldToken->refresh();
    expect($oldToken->isRevoked())->toBeTrue();

    $newToken = RefreshToken::query()
        ->where('user_id', $user->id)
        ->whereNull('revoked_at')
        ->first();
    expect($newToken)->not->toBeNull()
        ->and($newToken->id)->not->toBe($oldId)
        ->and($newToken->parent_id)->toBe($oldId);
});

it('issues a fresh Sanctum access token for the rotated user', function (): void {
    $old = obtainRefreshToken();
    $user = User::query()->where('mobile', '9876543210')->first();
    $initialTokenCount = $user->tokens()->count();

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $old])
        ->assertOk();

    expect($user->tokens()->count())->toBe($initialTokenCount + 1);
});
