<?php

declare(strict_types=1);

use App\Modules\Authentication\Models\Otp;

it('boots the Otp model with a uuid PK and no updated_at', function (): void {
    $otp = new Otp;

    expect($otp->getKeyType())->toBe('string')
        ->and($otp->getIncrementing())->toBeFalse()
        ->and($otp->getTable())->toBe('otps')
        ->and($otp->timestamps)->toBeFalse();
});

it('casts expires_at, consumed_at, created_at as datetime and attempts as integer', function (): void {
    $otp = new Otp;
    $casts = $otp->getCasts();

    expect($casts)->toHaveKey('expires_at')
        ->and($casts['expires_at'])->toBe('datetime')
        ->and($casts)->toHaveKey('consumed_at')
        ->and($casts['consumed_at'])->toBe('datetime')
        ->and($casts)->toHaveKey('attempts')
        ->and($casts['attempts'])->toBe('integer')
        ->and($casts)->toHaveKey('created_at')
        ->and($casts['created_at'])->toBe('datetime');
});

it('isExpired() returns true when expires_at is in the past', function (): void {
    $otp = new Otp(['expires_at' => now()->subMinute()]);
    expect($otp->isExpired())->toBeTrue();
});

it('isExpired() returns false when expires_at is in the future', function (): void {
    $otp = new Otp(['expires_at' => now()->addMinutes(5)]);
    expect($otp->isExpired())->toBeFalse();
});

it('isConsumed() returns true only when consumed_at is set', function (): void {
    $otp = new Otp(['consumed_at' => null]);
    expect($otp->isConsumed())->toBeFalse();

    $otp->consumed_at = now();
    expect($otp->isConsumed())->toBeTrue();
});

it('isUsable() combines expiry + consumed + attempts < 5', function (): void {
    $otp = new Otp(['expires_at' => now()->addMinutes(5), 'attempts' => 0]);
    expect($otp->isUsable())->toBeTrue();

    $otp->attempts = 5;
    expect($otp->isUsable())->toBeFalse();

    $otp->attempts = 0;
    $otp->expires_at = now()->subMinute();
    expect($otp->isUsable())->toBeFalse();

    $otp->expires_at = now()->addMinutes(5);
    $otp->consumed_at = now();
    expect($otp->isUsable())->toBeFalse();
});

it('incrementAttempts() increments and persists the counter', function (): void {
    $otp = Otp::query()->create([
        'mobile' => '9876543210',
        'code_hash' => password_hash('123456', PASSWORD_BCRYPT),
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'created_at' => now(),
    ]);

    expect($otp->incrementAttempts())->toBe(1);
    expect($otp->fresh()->attempts)->toBe(1);

    expect($otp->incrementAttempts())->toBe(2);
    expect($otp->fresh()->attempts)->toBe(2);
});

it('markConsumed() sets consumed_at and persists', function (): void {
    $otp = Otp::query()->create([
        'mobile' => '9876543210',
        'code_hash' => password_hash('123456', PASSWORD_BCRYPT),
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'created_at' => now(),
    ]);

    expect($otp->isConsumed())->toBeFalse();
    $otp->markConsumed();
    expect($otp->fresh()->isConsumed())->toBeTrue();
});

it('latestFor() scope returns the most recent record for the mobile', function (): void {
    $mobile = '9876543210';
    Otp::query()->create([
        'mobile' => $mobile,
        'code_hash' => 'h1',
        'expires_at' => now()->addMinutes(5),
        'created_at' => now()->subMinutes(10),
    ]);
    $latest = Otp::query()->create([
        'mobile' => $mobile,
        'code_hash' => 'h2',
        'expires_at' => now()->addMinutes(5),
        'created_at' => now(),
    ]);

    $fetched = Otp::query()->latestFor($mobile)->first();
    expect($fetched->id)->toBe($latest->id);
});
