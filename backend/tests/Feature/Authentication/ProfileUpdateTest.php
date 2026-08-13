<?php

declare(strict_types=1);

use App\Modules\Authentication\Services\AuthenticationService;
use App\Modules\Authentication\Services\OtpService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function profileToken(): array
{
    $service = app(AuthenticationService::class);
    $captured = null;
    $otp = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    app()->instance(OtpService::class, $otp);
    $otp->request('9876543211', '127.0.0.1');
    preg_match('/verification code is (\d{6})/', (string) $captured, $match);
    $result = $service->verifyOtp('9876543211', $match[1], '127.0.0.1');

    return [$result['user'], $result['access_token']];
}

it('lets a citizen complete their profile without changing verified identity fields', function (): void {
    [$user, $access] = profileToken();

    $this->withToken($access)
        ->patchJson('/api/v1/auth/profile', [
            'preferred_name' => '  Anu  ',
            'email' => 'anu@example.com',
            'preferred_locale' => 'kn-IN',
            'notification_channel' => 'push',
        ])
        ->assertOk()
        ->assertJsonPath('data.preferred_name', 'Anu')
        ->assertJsonPath('data.email', 'anu@example.com')
        ->assertJsonPath('data.preferred_locale', 'kn-IN')
        ->assertJsonPath('data.notification_channel', 'push')
        ->assertJsonPath('data.mobile', $user->mobile);

    expect($user->refresh()->preferred_name)->toBe('Anu')
        ->and($user->mobile)->toBe('9876543211');
});

it('rejects unsupported profile language or notification channel', function (): void {
    [, $access] = profileToken();

    $this->withToken($access)
        ->patchJson('/api/v1/auth/profile', [
            'preferred_locale' => 'hi-IN',
            'notification_channel' => 'whatsapp',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['preferred_locale', 'notification_channel']);
});
