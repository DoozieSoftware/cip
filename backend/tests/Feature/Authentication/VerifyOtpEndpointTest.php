<?php

declare(strict_types=1);

use App\Modules\Authentication\Events\UserAuthenticated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\Otp;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Authentication\Services\OtpService;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * Validates POST /api/v1/auth/verify-otp introduced in T-M2-014.
 *
 * Per docs/05 §5 (Verify OTP) and docs/11 §6-7.
 */
beforeEach(function (): void {
    // Seed the baseline roles + permissions so Spatie assignments
    // (citizen, moderator, etc.) work in tests.
    (new RolesAndPermissionsSeeder)->run();

    // Bind a deterministic fake OtpService so tests are reproducible
    // and the test can also call OtpService directly to issue an OTP
    // (since /send-otp uses the dispatcher).
    $service = new OtpService(static function (string $mobile, string $message): void {
        // no-op
    });
    $this->app->instance(OtpService::class, $service);

    $this->otpService = $service;
});

it('returns 200 with token, refresh_token, and user on a valid verify', function (): void {
    // Bind a captured-closure OtpService and issue exactly one OTP
    // for the test. The plain code is the only OTP in the table
    // when the endpoint runs, so OtpService::verify resolves it.
    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9876543210', '10.0.0.1', 'Pest/Test');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1] ?? null;
    expect($code)->not->toBeNull();

    $response = $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => $code,
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'token' => ['access_token', 'type', 'expires_at'],
                'refresh_token',
                'refresh_expires_at',
                'user' => [
                    'id', 'mobile', 'roles', 'permissions', 'status', 'anonymous_enabled',
                ],
            ],
        ]);

    $data = $response->json('data');
    expect($data['token']['type'])->toBe('Bearer')
        ->and($data['token']['access_token'])->toBeString()->not->toBeEmpty()
        ->and($data['refresh_token'])->toBeString()->toHaveLength(64)
        ->and($data['user']['mobile'])->toBe('9876543210')
        ->and($data['user']['roles'])->toContain('citizen');
});

it('rejects an invalid code with 401 and records a failure login_history row', function (): void {
    $this->otpService->request('9876543210', '10.0.0.1');

    $response = $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => '000000',
    ]);

    $response->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');

    $rows = LoginHistory::query()->get();
    expect($rows)->toHaveCount(1)
        ->and($rows->first()->success)->toBeFalse()
        ->and($rows->first()->user_id)->toBeNull();
});

it('rejects a malformed body with 422', function (): void {
    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => 'abc',
        'code' => '12',
    ])->assertStatus(422);
});

it('upserts the user — first contact creates a citizen with citizen role', function (): void {
    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9999999999', '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    expect(User::query()->where('mobile', '9999999999')->exists())->toBeFalse();

    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9999999999',
        'code' => $code,
    ])->assertOk();

    $user = User::query()->where('mobile', '9999999999')->first();
    expect($user)->not->toBeNull()
        ->and($user->hasRole('citizen'))->toBeTrue()
        ->and($user->otp_verified_at)->not->toBeNull()
        ->and($user->last_login_ip)->toBe('127.0.0.1');
});

it('does not create a duplicate user on subsequent verifications', function (): void {
    $existing = User::factory()->citizen()->create(['mobile' => '9876543210']);

    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9876543210', '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => $code,
    ])->assertOk();

    expect(User::query()->where('mobile', '9876543210')->count())->toBe(1)
        ->and(User::query()->where('mobile', '9876543210')->first()->id)->toBe($existing->id);
});

it('issues a Sanctum personal access token + a refresh token on success', function (): void {
    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9876543210', '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => $code,
    ])->assertOk();

    $user = User::query()->where('mobile', '9876543210')->first();
    expect($user->tokens()->count())->toBe(1)
        ->and(RefreshToken::query()->where('user_id', $user->id)->count())->toBe(1);
});

it('writes a success login_history row linked to the user', function (): void {
    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9876543210', '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => $code,
    ])->assertOk();

    $user = User::query()->where('mobile', '9876543210')->first();
    $history = LoginHistory::query()->where('user_id', $user->id)->first();

    expect($history)->not->toBeNull()
        ->and($history->success)->toBeTrue()
        ->and($history->failure_reason)->toBeNull()
        ->and($history->ip)->toBe('127.0.0.1')
        ->and($history->mobile)->toBe('9876543210');
});

it('emits the UserAuthenticated event on success', function (): void {
    Event::fake([UserAuthenticated::class]);

    $captured = null;
    $service = new OtpService(static function (string $mobile, string $message) use (&$captured): void {
        $captured = $message;
    });
    $this->app->instance(OtpService::class, $service);
    $service->request('9876543210', '10.0.0.1');
    preg_match('/verification code is (\d{6})/', $captured, $m);
    $code = $m[1];

    $this->postJson('/api/v1/auth/verify-otp', [
        'mobile' => '9876543210',
        'code' => $code,
    ])->assertOk();

    Event::assertDispatched(UserAuthenticated::class, function (UserAuthenticated $event): bool {
        return $event->user->mobile === '9876543210' && $event->channel === 'otp';
    });
});
