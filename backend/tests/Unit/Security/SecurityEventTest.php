<?php

declare(strict_types=1);

use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Shared\Exceptions\ModelImmutableException;
use App\Modules\Users\Models\User;

it('boots the SecurityEvent model with a uuid PK and no updated_at', function (): void {
    $event = new SecurityEvent;

    expect($event->getKeyType())->toBe('string')
        ->and($event->getIncrementing())->toBeFalse()
        ->and($event->getTable())->toBe('security_events')
        ->and($event->timestamps)->toBeFalse();
});

it('casts metadata as array and created_at as datetime', function (): void {
    $event = new SecurityEvent;
    $casts = $event->getCasts();

    expect($casts)->toHaveKey('metadata')
        ->and($casts['metadata'])->toBe('array')
        ->and($casts)->toHaveKey('created_at')
        ->and($casts['created_at'])->toBe('datetime');
});

it('exposes the three severity constants', function (): void {
    expect(SecurityEvent::ALLOWED_SEVERITIES)->toBe(['info', 'warning', 'critical'])
        ->and(SecurityEvent::SEVERITY_INFO)->toBe('info')
        ->and(SecurityEvent::SEVERITY_WARNING)->toBe('warning')
        ->and(SecurityEvent::SEVERITY_CRITICAL)->toBe('critical');
});

it('inserts a new event (create works)', function (): void {
    $event = SecurityEvent::query()->create([
        'user_id' => null,
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'metadata' => ['ip' => '10.0.0.1'],
        'ip' => '10.0.0.1',
        'user_agent' => 'Pest/Test',
        'created_at' => now(),
    ]);

    expect($event->exists)->toBeTrue()
        ->and($event->severity)->toBe('info')
        ->and($event->metadata)->toBe(['ip' => '10.0.0.1']);
});

it('blocks update() once the row exists', function (): void {
    $event = SecurityEvent::query()->create([
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'created_at' => now(),
    ]);

    $event->severity = 'critical';

    $event->save();
})->throws(ModelImmutableException::class);

it('blocks delete() entirely', function (): void {
    $event = SecurityEvent::query()->create([
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'created_at' => now(),
    ]);

    $event->delete();
})->throws(ModelImmutableException::class);

it('blocks forceDelete() too', function (): void {
    $event = SecurityEvent::query()->create([
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'created_at' => now(),
    ]);

    $event->forceDelete();
})->throws(ModelImmutableException::class);

it('relates to a user (nullable) via user()', function (): void {
    $user = User::factory()->citizen()->create();

    $event = SecurityEvent::query()->create([
        'user_id' => $user->id,
        'event' => 'login.succeeded',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'created_at' => now(),
    ]);

    expect($event->user)->not->toBeNull()
        ->and($event->user->id)->toBe($user->id);
});
