<?php

declare(strict_types=1);

use App\Modules\Notifications\Channels\PushChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


it('returns a success ChannelResult when FCM returns 200', function (): void {
    Http::fake([
        'fcm.googleapis.com/*' => Http::response(['name' => 'projects/stub/messages/abc123'], 200),
    ]);

    $channel = app(PushChannel::class);
    [$notification, $template] = makePushFixtures();

    $result = $channel->send($notification, $template);

    expect($result)->toBeInstanceOf(ChannelResult::class)
        ->and($result->success)->toBeTrue()
        ->and($result->error)->toBeNull()
        ->and($result->latencyMs)->toBeGreaterThanOrEqual(0)
        ->and($result->providerResponse['message_name'])->toBe('projects/stub/messages/abc123');

    Http::assertSent(function ($request) use ($notification): bool {
        $body = $request->data();

        return $request->url() === 'https://fcm.googleapis.com/v1/projects/stub/messages:send'
            && $request->hasHeader('Authorization', 'Bearer stub-access-token')
            && $body['message']['token'] === 'device-token-1'
            && $body['message']['notification']['title'] === 'Subject'
            && $body['message']['data']['notification_id'] === (string) $notification->id;
    });
});

it('returns a permanent failure for HTTP 4xx errors', function (): void {
    Http::fake([
        'fcm.googleapis.com/*' => Http::response([
            'error' => [
                'details' => [['errorCode' => 'UNREGISTERED']],
            ],
        ], 404),
    ]);

    $channel = app(PushChannel::class);
    [$notification, $template] = makePushFixtures();

    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toBe('UNREGISTERED')
        ->and($result->latencyMs)->toBeGreaterThanOrEqual(0);
});

it('returns a transient failure for HTTP 5xx errors', function (): void {
    Http::fake([
        'fcm.googleapis.com/*' => Http::response(['error' => 'server'], 502),
    ]);

    $channel = app(PushChannel::class);
    [$notification, $template] = makePushFixtures();

    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeTrue()
        ->and($result->error)->toContain('502');
});

it('returns a transient failure on network timeout', function (): void {
    Http::fake([
        'fcm.googleapis.com/*' => function (): void {
            throw new RuntimeException('cURL error 28: Operation timed out');
        },
    ]);

    $channel = app(PushChannel::class);
    [$notification, $template] = makePushFixtures();

    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeTrue()
        ->and($result->error)->toContain('timed out');
});

it('returns a permanent failure when the payload has no device token', function (): void {
    Http::fake();

    $channel = app(PushChannel::class);
    [$notification, $template] = makePushFixtures(deviceToken: null);

    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toBe('notification payload missing device token');

    Http::assertNothingSent();
});

/**
 * @return array{0: Notification, 1: NotificationTemplate}
 */
function makePushFixtures(?string $deviceToken = 'device-token-1'): array
{
    $template = new NotificationTemplate([
        'code' => 'report.assigned',
        'name' => 'Report Assigned',
        'channel' => 'push',
        'subject' => 'Subject',
        'body' => 'Body text',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $template->id = (string) Str::uuid();
    $template->save();

    $notification = new Notification([
        'user_id' => User::factory()->create()->id,
        'type' => 'report.assigned',
        'channel' => 'push',
        'payload' => array_filter([
            'device_token' => $deviceToken,
            'report_id' => (string) Str::uuid(),
        ], static fn ($v) => $v !== null),
        'status' => 'pending',
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    return [$notification, $template];
}
