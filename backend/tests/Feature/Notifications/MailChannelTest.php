<?php

declare(strict_types=1);

use App\Modules\Notifications\Channels\MailChannel;
use App\Modules\Notifications\Mail\TemplateMailable;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Mail;

it('sends a TemplateMailable to the user email and reports success', function (): void {
    Mail::fake();

    $user = User::factory()->create(['email' => 'citizen@example.test']);
    $tpl = NotificationTemplate::create([
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'email',
        'subject' => 'Update on your report',
        'body' => 'Your report {{report_id}} moved to {{status}}.',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'email',
        'payload' => ['report_id' => 'r1', 'status' => 'in_progress'],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    $result = (new MailChannel)->send($n, $tpl);

    expect($result->success)->toBeTrue()
        ->and($result->latencyMs)->not->toBeNull();

    Mail::assertSent(TemplateMailable::class, function (TemplateMailable $m) use ($n, $tpl): bool {
        return $m->hasTo('citizen@example.test')
            && $m->notification->id === $n->id
            && $m->template->id === $tpl->id;
    });
});

it('returns a non-transient failure when the user has no email', function (): void {
    Mail::fake();

    $user = User::factory()->create(['email' => null]);
    $tpl = NotificationTemplate::create([
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'email',
        'subject' => 'Update',
        'body' => 'x',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'email',
        'payload' => [],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    $result = (new MailChannel)->send($n, $tpl);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toContain('no email');

    Mail::assertNothingSent();
});

it('falls back to a default subject when the template subject is null', function (): void {
    Mail::fake();

    $user = User::factory()->create(['email' => 'a@b.test']);
    $tpl = NotificationTemplate::create([
        'code' => 'c',
        'name' => 'c',
        'channel' => 'email',
        'subject' => null,
        'body' => 'b',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'c',
        'channel' => 'email',
        'payload' => [],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    (new MailChannel)->send($n, $tpl);

    Mail::assertSent(TemplateMailable::class, function (TemplateMailable $m): bool {
        return $m->envelope()->subject === 'Civic Platform notification';
    });
});
