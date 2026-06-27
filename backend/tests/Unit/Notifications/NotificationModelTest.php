<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationLog;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Users\Models\User;

it('Notification::user() belongs to a User', function (): void {
    $user = User::factory()->create();
    $notification = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'push',
        'payload' => ['report_id' => 'abc'],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    expect($notification->user)->toBeInstanceOf(User::class)
        ->and($notification->user->id)->toBe($user->id);
});

it('Notification::logs() returns the appended history', function (): void {
    $user = User::factory()->create();
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'email',
        'payload' => ['k' => 'v'],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);

    NotificationLog::create([
        'notification_id' => $n->id,
        'channel' => 'email',
        'status' => 'sent',
        'provider_response' => ['ok' => true],
        'latency_ms' => 100,
        'attempted_at' => now(),
    ]);

    expect($n->logs)->toHaveCount(1)
        ->and($n->logs->first())->toBeInstanceOf(NotificationLog::class);
});

it('Notification::payload is cast to/from array', function (): void {
    $user = User::factory()->create();
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'sms',
        'payload' => ['report_id' => 'r1', 'status' => 'in_progress', 'priority' => 2],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    expect($n->payload)->toBeArray()
        ->and($n->payload['report_id'])->toBe('r1')
        ->and($n->payload['priority'])->toBe(2);

    $refreshed = Notification::find($n->id);
    expect($refreshed->payload)->toBe($n->payload);
});

it('NotificationTemplate casts variables, version, and active', function (): void {
    $tpl = NotificationTemplate::create([
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'push',
        'subject' => 'Update',
        'body' => 'Your report {{report_id}} moved to {{status}}.',
        'variables' => ['report_id', 'status'],
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);

    expect($tpl->variables)->toBe(['report_id', 'status'])
        ->and($tpl->version)->toBe(1)
        ->and($tpl->active)->toBeTrue();
});

it('NotificationLog is append-only — update() throws', function (): void {
    $user = User::factory()->create();
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 't',
        'channel' => 'push',
        'payload' => [],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $log = NotificationLog::create([
        'notification_id' => $n->id,
        'channel' => 'push',
        'status' => 'sent',
        'provider_response' => ['ok' => true],
        'latency_ms' => 50,
        'attempted_at' => now(),
    ]);

    expect(fn () => $log->update(['status' => 'failed']))
        ->toThrow(RuntimeException::class, 'append-only');
});

it('NotificationLog is append-only — delete() throws', function (): void {
    $user = User::factory()->create();
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 't',
        'channel' => 'push',
        'payload' => [],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $log = NotificationLog::create([
        'notification_id' => $n->id,
        'channel' => 'push',
        'status' => 'sent',
        'provider_response' => ['ok' => true],
        'latency_ms' => 50,
        'attempted_at' => now(),
    ]);

    expect(fn () => $log->delete())->toThrow(RuntimeException::class, 'append-only');
});

it('NotificationLog casts provider_response from JSON to array', function (): void {
    $user = User::factory()->create();
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 't',
        'channel' => 'email',
        'payload' => [],
        'status' => Notification::STATUS_SENT,
        'retry_count' => 0,
    ]);
    $log = NotificationLog::create([
        'notification_id' => $n->id,
        'channel' => 'email',
        'status' => 'sent',
        'provider_response' => ['message_id' => 'm-1', 'code' => 200],
        'latency_ms' => 200,
        'attempted_at' => now(),
    ]);

    expect($log->provider_response)->toBe(['message_id' => 'm-1', 'code' => 200])
        ->and($log->latency_ms)->toBe(200);
});
