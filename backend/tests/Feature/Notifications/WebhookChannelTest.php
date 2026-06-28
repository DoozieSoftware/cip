<?php

declare(strict_types=1);

use App\Modules\Notifications\Channels\WebhookChannel;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

it('returns a success ChannelResult when the webhook returns 2xx', function (): void {
    Http::fake([
        'hooks.example.com/*' => Http::response(['ok' => true], 202),
    ]);

    [$notification, $template] = makeWebhookFixtures(url: 'https://hooks.example.com/inbound');

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeTrue()
        ->and($result->latencyMs)->toBeGreaterThanOrEqual(0)
        ->and($result->providerResponse['status'])->toBe(202);

    Http::assertSent(function ($request): bool {
        $body = $request->data();

        return $request->url() === 'https://hooks.example.com/inbound'
            && $request->hasHeader('X-CIP-Signature')
            && str_starts_with($request->header('X-CIP-Signature')[0], 'sha256=')
            && $request->hasHeader('X-CIP-Timestamp')
            && $body['type'] === 'report.assigned'
            && $body['template']['code'] === 'report.assigned';
    });
});

it('returns a permanent failure for HTTP 4xx', function (): void {
    Http::fake([
        'hooks.example.com/*' => Http::response(['error' => 'bad signature'], 401),
    ]);

    [$notification, $template] = makeWebhookFixtures();

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toContain('401');
});

it('returns a transient failure for HTTP 5xx', function (): void {
    Http::fake([
        'hooks.example.com/*' => Http::response(['error' => 'unavailable'], 503),
    ]);

    [$notification, $template] = makeWebhookFixtures();

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeTrue()
        ->and($result->error)->toContain('503');
});

it('returns a transient failure on network timeout', function (): void {
    Http::fake([
        'hooks.example.com/*' => function (): void {
            throw new RuntimeException('cURL error 28: Operation timed out');
        },
    ]);

    [$notification, $template] = makeWebhookFixtures();

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeTrue();
});

it('returns a permanent failure when no webhook URL is configured', function (): void {
    Http::fake();

    [$notification, $template] = makeWebhookFixtures(url: null, type: 'unknown.event');

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toBe('webhook url not configured for notification type');

    Http::assertNothingSent();
});

it('always returns a ChannelResult (never throws)', function (): void {
    Http::fake([
        'hooks.example.com/*' => Http::response(['ok' => true], 200),
    ]);

    [$notification, $template] = makeWebhookFixtures();

    $channel = app(WebhookChannel::class);
    $result = $channel->send($notification, $template);

    expect($result)->toBeInstanceOf(ChannelResult::class);
});

/**
 * @return array{0: Notification, 1: NotificationTemplate}
 */
function makeWebhookFixtures(?string $url = 'https://hooks.example.com/inbound', string $type = 'report.assigned'): array
{
    $template = new NotificationTemplate([
        'code' => 'report.assigned',
        'name' => 'Report Assigned',
        'channel' => 'webhook',
        'subject' => 'Subject',
        'body' => 'Body',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $template->id = (string) Str::uuid();
    $template->save();

    $payload = ['report_id' => (string) Str::uuid()];

    if ($url !== null) {
        $payload['webhook_url'] = $url;
    }

    $notification = new Notification([
        'user_id' => User::factory()->create()->id,
        'type' => $type,
        'channel' => 'webhook',
        'payload' => $payload,
        'status' => 'pending',
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    return [$notification, $template];
}
