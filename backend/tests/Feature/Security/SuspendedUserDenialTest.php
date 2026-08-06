<?php

declare(strict_types=1);

use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('denies a suspended user via password login with 403', function (): void {
    $staff = User::factory()->moderator()->create(['status' => 'suspended']);

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
    expect($staff->tokens()->count())->toBe(0);
});

it('denies a disabled user via password login with 403', function (): void {
    $staff = User::factory()->moderator()->create(['status' => 'disabled']);

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('denies a pending user via password login with 403', function (): void {
    $staff = User::factory()->moderator()->create(['status' => 'pending']);

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('denies a suspended user via verify-otp with 403', function (): void {
    $user = User::factory()->citizen()->create(['status' => 'suspended']);

    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request($user->mobile, '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $response = $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => $user->mobile,
        'code' => $code,
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
    expect($user->tokens()->count())->toBe(0);
});

it('denies a suspended user via token refresh with 403', function (): void {
    $user = User::factory()->citizen()->create();

    $captured = null;
    $otpService = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $otpService);
    $otpService->request($user->mobile, '127.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);

    $auth = app(AuthenticationService::class);
    $result = $auth->verifyOtp($user->mobile, $m[1], '127.0.0.1');
    $plain = $result['refresh']['plain'];

    $user->update(['status' => 'suspended']);

    $response = $this->postJson('/api/v1/auth/refresh', [
        'refresh_token' => $plain,
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('denies a suspended super_admin via password login with 403', function (): void {
    $admin = User::factory()->superAdmin()->create(['status' => 'suspended']);
    $admin->assignRole('super_admin');

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $admin->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
    expect($admin->tokens()->count())->toBe(0);
});

it('denies a suspended super_admin via verify-otp with 403', function (): void {
    $admin = User::factory()->superAdmin()->create(['status' => 'suspended']);
    $admin->assignRole('super_admin');

    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request($admin->mobile, '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $response = $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => $admin->mobile,
        'code' => $code,
    ]);

    $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
});

it('allows an active user to login normally after status enforcement', function (): void {
    $staff = User::factory()->moderator()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertOk();
    expect($staff->tokens()->count())->toBe(1);
});

it('allows an active user to refresh normally after status enforcement', function (): void {
    $user = User::factory()->citizen()->create();

    $captured = null;
    $otpService = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $otpService);
    $otpService->request($user->mobile, '127.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);

    $auth = app(AuthenticationService::class);
    $result = $auth->verifyOtp($user->mobile, $m[1], '127.0.0.1');
    $plain = $result['refresh']['plain'];

    $response = $this->postJson('/api/v1/auth/refresh', [
        'refresh_token' => $plain,
    ]);

    $response->assertOk();
});
