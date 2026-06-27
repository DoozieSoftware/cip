<?php

declare(strict_types=1);

use App\Modules\Notifications\Channels\LogChannel;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;

it('returns a success ChannelResult with sub-50ms latency', function (): void {
    $user = User::factory()->create();
    $tpl = NotificationTemplate::create([
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'log',
        'body' => 'Your report moved to {{status}}.',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'log',
        'payload' => ['status' => 'in_progress'],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    $result = (new LogChannel)->send($n, $tpl);

    expect($result->success)->toBeTrue()
        ->and($result->latencyMs)->not->toBeNull()
        ->and($result->latencyMs)->toBeLessThan(50)
        ->and($result->providerResponse)->toMatchArray(['driver' => 'log']);
});

it('writes the rendered payload to the named log channel via a Mockery double', function (): void {
    $mockChannel = Mockery::mock();
    $mockChannel->shouldReceive('info')
        ->once()
        ->with('notification.dispatched', Mockery::on(function (array $ctx): bool {
            return $ctx['notification_id'] !== null
                && $ctx['type'] === 'report_status_changed'
                && $ctx['template_code'] === 'report_status_changed'
                && $ctx['payload'] === ['k' => 'v'];
        }));

    Log::shouldReceive('channel')
        ->with('notifications')
        ->andReturn($mockChannel);

    $user = User::factory()->create();
    $tpl = NotificationTemplate::create([
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'log',
        'body' => 'x',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $n = Notification::create([
        'user_id' => $user->id,
        'type' => 'report_status_changed',
        'channel' => 'log',
        'payload' => ['k' => 'v'],
        'status' => Notification::STATUS_PENDING,
        'retry_count' => 0,
    ]);

    $result = (new LogChannel)->send($n, $tpl);
    expect($result->success)->toBeTrue();
});
