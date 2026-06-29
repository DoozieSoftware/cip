<?php

declare(strict_types=1);

use App\Modules\Notifications\Jobs\SendNotificationJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Notifications\Mail\TemplateMailable;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationLog;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


beforeEach(function (): void {
    Bus::fake();
});

it('marks a successful delivery as sent and writes a notification_logs row', function (): void {
    Mail::fake();

    $tpl = makeJobTemplate(channel: 'email', body: 'Hi {name}');
    $user = User::factory()->create(['email' => 'citizen@example.test']);
    $notification = makeJobNotification($user, $tpl, ['name' => 'Anu']);

    (new SendNotificationJob($notification->id))->handle();

    $fresh = $notification->fresh();
    expect($fresh->status)->toBe(Notification::STATUS_SENT)
        ->and($fresh->last_error)->toBeNull();

    $log = NotificationLog::query()->where('notification_id', $notification->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->status)->toBe('sent')
        ->and($log->channel)->toBe('email')
        ->and($log->latency_ms)->toBeGreaterThanOrEqual(0);

    Mail::assertSent(TemplateMailable::class);
});

it('marks a delivery as dead when the template is missing and writes an audit row', function (): void {
    $user = User::factory()->create(['email' => 'citizen@example.test']);
    $notification = new Notification([
        'user_id' => $user->id,
        'type' => 'orphan',
        'channel' => 'email',
        'payload' => ['template_id' => null],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    (new SendNotificationJob($notification->id))->handle();

    $fresh = $notification->fresh();
    expect($fresh->status)->toBe(Notification::STATUS_DEAD)
        ->and($fresh->last_error)->toBe('template not found for notification');

    $audit = AuditLog::query()->where('action', 'notification.dead_letter')->first();
    expect($audit)->not->toBeNull()
        ->and($audit->entity)->toBe('notification')
        ->and($audit->entity_id)->toBe($notification->id)
        ->and($audit->after['error'])->toBe('template not found for notification');
});

it('honors the backoff schedule (1m, 5m, 15m, 60m)', function (): void {
    $job = new SendNotificationJob('whatever');

    expect($job->backoff())->toBe([60, 300, 900, 3600])
        ->and($job->tries)->toBe(5)
        ->and($job->timeout)->toBe(30);
});

it('no-ops if the notification does not exist', function (): void {
    $job = new SendNotificationJob((string) Str::uuid());

    $job->handle();

    expect(NotificationLog::query()->count())->toBe(0);
});

it('is a ShouldQueue job with the queueable interface', function (): void {
    $job = new SendNotificationJob('x');

    expect($job)->toBeInstanceOf(ShouldQueue::class)
        ->and($job->tries)->toBe(5);
});

it('does not re-process a notification that is already dead', function (): void {
    Mail::fake();

    $tpl = makeJobTemplate(channel: 'email', body: 'Hi {name}');
    $user = User::factory()->create(['email' => 'citizen@example.test']);
    $notification = makeJobNotification($user, $tpl, ['name' => 'Anu']);
    $notification->status = Notification::STATUS_DEAD;
    $notification->save();

    (new SendNotificationJob($notification->id))->handle();

    expect(NotificationLog::query()->where('notification_id', $notification->id)->count())->toBe(0);
});

function makeJobTemplate(string $channel, string $body = 'Hi {name}', string $subject = 'Subject'): NotificationTemplate
{
    $tpl = new NotificationTemplate([
        'code' => 'job.test',
        'name' => 'Job Test',
        'channel' => $channel,
        'subject' => $subject,
        'body' => $body,
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $tpl->id = (string) Str::uuid();
    $tpl->save();

    return $tpl;
}

function makeJobNotification(User $user, NotificationTemplate $tpl, array $variables): Notification
{
    $rendered = [
        'subject' => 'Subject',
        'body' => 'Hi '.$variables['name'],
    ];

    $notification = new Notification([
        'user_id' => $user->id,
        'type' => 'job.test',
        'channel' => $tpl->channel,
        'payload' => [
            'template_id' => $tpl->id,
            'template_code' => $tpl->code,
            'rendered' => $rendered,
            'variables' => $variables,
        ],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    return $notification;
}
