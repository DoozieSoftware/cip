<?php

declare(strict_types=1);

use App\Modules\Authentication\Events\UserAuthenticated;
use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * Validates POST /api/v1/auth/login — staff password login (docs/11
 * §8). Citizens are OTP-only and never have a password set.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

it('returns 200 with token, refresh_token, and user on valid staff credentials', function (): void {
    $staff = User::factory()->moderator()->create();
    $staff->assignRole('moderator');

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'token' => ['access_token', 'type', 'expires_at'],
                'refresh_token',
                'refresh_expires_at',
                'user' => ['id', 'mobile', 'roles', 'permissions'],
            ],
        ]);

    $data = $response->json('data');
    expect($data['token']['type'])->toBe('Bearer')
        ->and($data['refresh_token'])->toBeString()->toHaveLength(64)
        ->and($data['user']['mobile'])->toBe($staff->mobile)
        ->and($data['user']['roles'])->toContain('moderator');

    expect($staff->tokens()->count())->toBe(1)
        ->and(RefreshToken::query()->where('user_id', $staff->id)->count())->toBe(1);
});

it('rejects a wrong password with 401 and records a failed login_history row', function (): void {
    $staff = User::factory()->moderator()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401)->assertJsonPath('code', 'UNAUTHORIZED');

    $row = LoginHistory::query()->where('mobile', $staff->mobile)->first();
    expect($row)->not->toBeNull()
        ->and($row->success)->toBeFalse()
        ->and($row->user_id)->toBe($staff->id)
        ->and($row->failure_reason)->toBe('invalid_credentials');
});

it('rejects an unknown mobile with 401 without leaking whether the account exists', function (): void {
    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => '9000000000',
        'password' => 'whatever-Password1!',
    ]);

    $response->assertStatus(401)->assertJsonPath('code', 'UNAUTHORIZED');

    $row = LoginHistory::query()->where('mobile', '9000000000')->first();
    expect($row)->not->toBeNull()
        ->and($row->user_id)->toBeNull()
        ->and($row->success)->toBeFalse();
});

it('rejects a citizen account (no password set) with 401, never a 500', function (): void {
    $citizen = User::factory()->citizen()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'mobile' => $citizen->mobile,
        'password' => 'anything-Password1!',
    ]);

    $response->assertStatus(401)->assertJsonPath('code', 'UNAUTHORIZED');
});

it('locks out after 5 failed attempts within 15 minutes and returns 429', function (): void {
    $staff = User::factory()->moderator()->create();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', [
            'mobile' => $staff->mobile,
            'password' => 'wrong-password',
        ])->assertStatus(401);
    }

    // The 6th attempt is locked out even with the CORRECT password.
    $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ])->assertStatus(429);
});

it('emits LOGIN_SUCCESS on success and LOGIN_FAILURE on failure', function (): void {
    $staff = User::factory()->moderator()->create();

    $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'wrong-password',
    ])->assertStatus(401);

    $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ])->assertOk();

    expect(SecurityEvent::query()->where('event', 'LOGIN_FAILURE')->count())->toBe(1)
        ->and(SecurityEvent::query()->where('event', 'LOGIN_SUCCESS')->count())->toBe(1);
});

it('emits the UserAuthenticated event with channel=password on success', function (): void {
    Event::fake([UserAuthenticated::class]);
    $staff = User::factory()->moderator()->create();

    $this->postJson('/api/v1/auth/login', [
        'mobile' => $staff->mobile,
        'password' => 'Password1!',
    ])->assertOk();

    Event::assertDispatched(UserAuthenticated::class, fn (UserAuthenticated $event): bool => $event->user->mobile === $staff->mobile && $event->channel === 'password');
});

it('rejects a malformed body with 422', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'mobile' => 'abc',
    ])->assertStatus(422);
});
