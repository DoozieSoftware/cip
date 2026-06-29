<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);


/**
 * Validates the UserFactory states introduced in T-M2-003.
 *
 * Per docs/04 §6, the user table is uuid-PK, has a unique mobile, and
 * distinguishes citizens (mobile + OTP) from staff (email + password).
 * Per docs/15 §6, factory states must be deterministic and round-trippable.
 */
it('produces a baseline user with a uuid PK and unique mobile', function (): void {
    $user = User::factory()->create();

    expect($user->id)->toBeString()
        ->and(strlen($user->id))->toBe(36) // canonical UUID v4
        ->and($user->mobile)->toStartWith('9')
        ->and($user->status)->toBe('active');

    // uniqueness — second user gets a different mobile
    $other = User::factory()->create();
    expect($other->mobile)->not->toBe($user->mobile);
});

it('citizen() state sets a verified mobile, no email, no password', function (): void {
    $user = User::factory()->citizen()->create();

    expect($user->email)->toBeNull()
        ->and($user->password)->toBeNull()
        ->and($user->otp_verified_at)->not->toBeNull()
        ->and($user->status)->toBe('active')
        ->and($user->anonymous_enabled)->toBeFalse();
});

it('moderator() state sets an email and hashed password', function (): void {
    $user = User::factory()->moderator()->create();

    expect($user->email)->not->toBeNull()
        ->and($user->email)->toEndWith('@cip.test')
        ->and($user->password)->not->toBeNull()
        ->and($user->otp_verified_at)->toBeNull()
        ->and($user->status)->toBe('active');

    // password must be hashed, not plaintext
    expect(password_get_info($user->password)['algo'])->toBe(PASSWORD_BCRYPT);
});

it('departmentOfficer() state matches the staff surface', function (): void {
    $user = User::factory()->departmentOfficer()->create();

    expect($user->email)->not->toBeNull()
        ->and($user->password)->not->toBeNull()
        ->and($user->otp_verified_at)->toBeNull();
});

it('superAdmin() state matches the staff surface and is active', function (): void {
    $user = User::factory()->superAdmin()->create();

    expect($user->email)->not->toBeNull()
        ->and($user->password)->not->toBeNull()
        ->and($user->status)->toBe('active');
});

it('suspended() state forces status to suspended', function (): void {
    $user = User::factory()->suspended()->create();

    expect($user->status)->toBe('suspended')
        ->and($user->isActive())->toBeFalse();
});

it('anonymous() state enables anonymous reporting', function (): void {
    $user = User::factory()->anonymous()->create();

    expect($user->anonymous_enabled)->toBeTrue();
});

it('chains states — anonymous citizen', function (): void {
    $user = User::factory()->citizen()->anonymous()->create();

    expect($user->otp_verified_at)->not->toBeNull()
        ->and($user->anonymous_enabled)->toBeTrue();
});

it('creates many users without violating the unique mobile index', function (): void {
    $users = User::factory()->count(10)->create();

    expect($users)->toHaveCount(10);
    $mobiles = $users->pluck('mobile')->all();
    expect(array_unique($mobiles))->toHaveCount(10);
});
