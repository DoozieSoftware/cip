<?php

declare(strict_types=1);

use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use Database\Seeders\RolesAndPermissionsSeeder;

/**
 * Validates GET /api/v1/auth/me introduced in T-M2-017.
 *
 * Per docs/05 §5 (Current User) and docs/11 §9. The endpoint returns
 * the authenticated user, their roles, and the union of their
 * permissions via UserResource.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

/**
 * Walk the full verify-otp flow to obtain a user + access token.
 * Returns [user, access_token_plain].
 */
function obtainUserAndToken(): array
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

    return [$r['user'], $r['access_token']];
}

it('returns 200 with the authenticated user envelope', function (): void {
    [$user, $access] = obtainUserAndToken();

    $response = $this->withToken($access)
        ->getJson('/api/v1/auth/me');

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.mobile', '9876543210')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'name',
                'mobile',
                'email',
                'anonymous_enabled',
                'status',
                'otp_verified_at',
                'last_login_at',
                'roles',
                'permissions',
                'created_at',
            ],
        ]);
});

it('includes the citizen role for an OTP-verified user', function (): void {
    [$user, $access] = obtainUserAndToken();

    $this->withToken($access)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.roles', ['citizen']);
});

it('includes the empty permissions array for a baseline citizen', function (): void {
    [$user, $access] = obtainUserAndToken();

    $this->withToken($access)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.permissions', []);
});

it('exposes never the password or 2FA secret fields', function (): void {
    [$user, $access] = obtainUserAndToken();

    $response = $this->withToken($access)->getJson('/api/v1/auth/me');

    $response->assertOk()
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.two_factor_secret')
        ->assertJsonMissingPath('data.two_factor_recovery_codes')
        ->assertJsonMissingPath('data.remember_token');
});

it('returns 401 when called without a bearer token', function (): void {
    $this->getJson('/api/v1/auth/me')
        ->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});

it('returns 401 when called with a revoked bearer token', function (): void {
    [$user, $access] = obtainUserAndToken();

    // Revoke the access token directly (simulates post-logout).
    $user->tokens()->delete();

    $this->withToken($access)
        ->getJson('/api/v1/auth/me')
        ->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});
