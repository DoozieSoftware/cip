<?php

declare(strict_types=1);

use App\Modules\Users\Models\User;

it('boots the user model with a UUID primary key', function (): void {
    $user = new User;
    expect($user->getKeyType())->toBe('string');
    expect($user->getIncrementing())->toBeFalse();
    expect($user->getKeyName())->toBe('id');
});

it('uses the users table', function (): void {
    $user = new User;
    expect($user->getTable())->toBe('users');
});

it('declares the correct fillable, hidden, and cast surface', function (): void {
    $user = new User;
    $fillable = $user->getFillable();
    expect($fillable)->toContain('mobile');
    expect($fillable)->toContain('email');
    expect($fillable)->toContain('name');
    expect($fillable)->toContain('status');
    expect($fillable)->toContain('anonymous_enabled');

    $hidden = $user->getHidden();
    expect($hidden)->toContain('password');
    expect($hidden)->toContain('remember_token');
    expect($hidden)->toContain('two_factor_secret');
    expect($hidden)->toContain('two_factor_recovery_codes');

    $casts = $user->getCasts();
    expect($casts)->toHaveKey('anonymous_enabled');
    expect($casts['anonymous_enabled'])->toBe('boolean');
    expect($casts)->toHaveKey('otp_verified_at');
    expect($casts['otp_verified_at'])->toBe('datetime');
    expect($casts)->toHaveKey('password');
    expect($casts['password'])->toBe('hashed');
});

it('considers a user active only when status is active and not soft-deleted', function (): void {
    $user = new User(['status' => 'active']);
    expect($user->isActive())->toBeTrue();

    $user->status = 'suspended';
    expect($user->isActive())->toBeFalse();
});

it('records last_login_at and last_login_ip via recordLogin', function (): void {
    $user = new User;
    $user->forceFill(['id' => '00000000-0000-0000-0000-000000000001', 'mobile' => '9999999999'])->save();
    $user->recordLogin('10.0.0.42');
    $user->refresh();
    expect($user->last_login_ip)->toBe('10.0.0.42');
    expect($user->last_login_at)->not->toBeNull();
});
