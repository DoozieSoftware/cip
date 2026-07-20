<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\NotificationLog;
use Illuminate\Database\Eloquent\Builder;

/**
 * NotificationLog is append-only delivery history (docs/04 §13):
 * the only write path is create(). It blocks update() and delete()
 * at the model layer and carries no updated_at, reinforcing the
 * same invariant the storage layer enforces. These tests exercise
 * the guard rails directly, without a database round-trip.
 */
it('disables Eloquent timestamps (append-only, attempted_at only)', function (): void {
    expect((new NotificationLog)->timestamps)->toBeFalse();
});

it('targets the notification_logs table', function (): void {
    expect((new NotificationLog)->getTable())->toBe('notification_logs');
});

it('casts provider_response, latency_ms and attempted_at', function (): void {
    $casts = (new NotificationLog)->getCasts();

    expect($casts['provider_response'])->toBe('array')
        ->and($casts['latency_ms'])->toBe('integer')
        ->and($casts['attempted_at'])->toBe('datetime');
});

it('blocks updates with a descriptive RuntimeException', function (): void {
    $log = new NotificationLog;

    $performUpdate = (new ReflectionClass($log))->getMethod('performUpdate');
    $performUpdate->setAccessible(true);

    expect(fn () => $performUpdate->invoke($log, Mockery::mock(Builder::class)))
        ->toThrow(RuntimeException::class, 'append-only');
});

it('blocks deletes with a descriptive RuntimeException', function (): void {
    $log = new NotificationLog;

    $performDelete = (new ReflectionClass($log))->getMethod('performDeleteOnModel');
    $performDelete->setAccessible(true);

    expect(fn () => $performDelete->invoke($log))
        ->toThrow(RuntimeException::class, 'cannot be deleted');
});
