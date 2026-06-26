<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\Sanctum;

/**
 * Validates POST /api/v1/auth/logout introduced in T-M2-016.
 *
 * Per docs/05 §5 (Logout) and docs/11 §6.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

/**
 * Walk the full verify-otp flow to obtain both tokens. Returns
 * [user, access_token_plain, refresh_token_plain].
 */
function obtainAuthPair(): array
{
    $service = app(AuthenticationService::class);

    $captured = null;
    $otp = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    app()->instance(OtpService::class, $otp);
    $otp->request('9876543210', '127.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);

    $r = $service->verifyOtp('9876543210', $m[1], '127.0.0.1');

    return [$r['user'], $r['access_token'], $r['refresh']['plain']];
}

it('returns 200 with {logged_out:true} on a successful logout', function (): void {
    [$user, $access, $refresh] = obtainAuthPair();

    $response = $this->withToken($access)
        ->postJson('/api/v1/auth/logout');

    $response->assertOk()
        ->assertJsonPath('data.logged_out', true);
});

it('revokes the current Sanctum access token (subsequent calls get 401)', function (): void {
    [$user, $access, $refresh] = obtainAuthPair();

    $this->withToken($access)->postJson('/api/v1/auth/logout')->assertOk();

    // The token is now invalid — Sanctum's auth guard rejects.
    // Auth::forgetGuards() forces the RequestGuard to re-resolve the
    // user on the next request. In production this is automatic
    // (each HTTP request has a fresh process), but in tests the
    // AuthManager singleton is reused across requests and the
    // RequestGuard would otherwise return the cached user.
    Auth::forgetGuards();

    $this->withToken($access)->postJson('/api/v1/auth/logout')
        ->assertStatus(401);
});

it('revokes the active refresh token (refresh endpoint rejects it)', function (): void {
    [$user, $access, $refresh] = obtainAuthPair();

    $this->withToken($access)->postJson('/api/v1/auth/logout')->assertOk();

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $refresh])
        ->assertStatus(401);
});

it('returns 401 for an unauthenticated logout request', function (): void {
    $this->postJson('/api/v1/auth/logout')->assertStatus(401);
});

it('revokes every active refresh token for the user (forced-logout guarantee)', function (): void {
    [$user, $access, $refresh] = obtainAuthPair();
    $activeBefore = RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->count();
    expect($activeBefore)->toBe(1);

    $this->withToken($access)->postJson('/api/v1/auth/logout')->assertOk();

    $activeAfter = RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->count();
    expect($activeAfter)->toBe(0);
});
