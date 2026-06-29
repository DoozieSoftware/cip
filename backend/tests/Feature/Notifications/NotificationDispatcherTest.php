<?php

declare(strict_types=1);

use App\Modules\Notifications\Exceptions\MissingTemplateVariableException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Notifications\Exceptions\TemplateNotFoundException;
use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


beforeEach(function (): void {
    $this->dispatcher = app(NotificationDispatcher::class);
});

it('persists a pending Notification and dispatches the SendNotificationJob', function (): void {
    Bus::fake([SendNotificationJob::class]);

    makeDispatcherTemplate(code: 'report.assigned', body: 'Hi {name}');
    $user = User::factory()->create();

    $notification = $this->dispatcher->dispatch($user, 'report.assigned', ['name' => 'Anu']);

    expect($notification)->toBeInstanceOf(Notification::class)
        ->and($notification->status)->toBe(Notification::STATUS_PENDING)
        ->and($notification->user_id)->toBe($user->id)
        ->and($notification->type)->toBe('report.assigned')
        ->and($notification->channel)->toBe('email')
        ->and($notification->payload['rendered']['body'])->toBe('Hi Anu')
        ->and($notification->payload['rendered']['subject'])->toBe('');

    Bus::assertDispatched(SendNotificationJob::class, function ($job) use ($notification): bool {
        return $job->notificationId === $notification->id;
    });
});

it('uses the channel declared on the template by default', function (): void {
    Bus::fake([SendNotificationJob::class]);

    makeDispatcherTemplate(code: 'push.test', body: 'push', channel: 'push');
    $user = User::factory()->create();

    $notification = $this->dispatcher->dispatch($user, 'push.test');

    expect($notification->channel)->toBe('push');
});

it('lets the caller override the channel', function (): void {
    Bus::fake([SendNotificationJob::class]);

    makeDispatcherTemplate(code: 'multi', body: 'b', channel: 'email');
    $user = User::factory()->create();

    $notification = $this->dispatcher->dispatch($user, 'multi', [], null, ['channel' => 'sms']);

    expect($notification->channel)->toBe('sms');
});

it('promotes the device_token override to the payload top level', function (): void {
    Bus::fake([SendNotificationJob::class]);

    makeDispatcherTemplate(code: 'push.test', body: 'b', channel: 'push');
    $user = User::factory()->create();

    $notification = $this->dispatcher->dispatch($user, 'push.test', [], null, [
        'device_token' => 'abc-123',
    ]);

    expect($notification->payload['device_token'])->toBe('abc-123');
});

it('throws TemplateNotFoundException when the template does not exist', function (): void {
    Bus::fake([SendNotificationJob::class]);
    $user = User::factory()->create();

    $this->dispatcher->dispatch($user, 'does.not.exist');
})->throws(TemplateNotFoundException::class);

it('throws MissingTemplateVariableException when a placeholder is absent', function (): void {
    Bus::fake([SendNotificationJob::class]);
    makeDispatcherTemplate(code: 'report.assigned', body: 'Hi {name}');
    $user = User::factory()->create();

    $this->dispatcher->dispatch($user, 'report.assigned', []);
})->throws(MissingTemplateVariableException::class);

it('persists the scheduled_at override', function (): void {
    Bus::fake([SendNotificationJob::class]);
    makeDispatcherTemplate(code: 'sched', body: 'b');
    $user = User::factory()->create();

    $when = now()->addHour();
    $notification = $this->dispatcher->dispatch($user, 'sched', [], null, [
        'scheduled_at' => $when,
    ]);

    expect($notification->scheduled_at?->timestamp)->toBe($when->timestamp);
});

it('uses the en template when the requested locale is missing', function (): void {
    Bus::fake([SendNotificationJob::class]);
    makeDispatcherTemplate(code: 'ml.test', body: 'en body', locale: 'en');
    $user = User::factory()->create();

    $notification = $this->dispatcher->dispatch($user, 'ml.test', [], 'kn');

    expect($notification->payload['rendered']['body'])->toBe('en body')
        ->and($notification->payload['template_code'])->toBe('ml.test');
});

function makeDispatcherTemplate(string $code, string $body, string $channel = 'email', string $locale = 'en'): NotificationTemplate
{
    $tpl = new NotificationTemplate([
        'code' => $code,
        'name' => Str::title(str_replace('.', ' ', $code)),
        'channel' => $channel,
        'subject' => null,
        'body' => $body,
        'locale' => $locale,
        'version' => 1,
        'active' => true,
    ]);
    $tpl->id = (string) Str::uuid();
    $tpl->save();

    return $tpl;
}
