<?php

declare(strict_types=1);

use App\Modules\Notifications\Channels\SmsChannel;
use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use App\Modules\Users\Models\User;
use Illuminate\Support\Str;
use Mockery as m;

afterEach(function (): void {
    m::close();
});

it('returns a success ChannelResult when the gateway accepts the message', function (): void {
    $gateway = m::mock(SmsGatewayInterface::class);
    $gateway->shouldReceive('send')
        ->once()
        ->with('+15551234567', 'Body text')
        ->andReturnNull();

    $this->app->instance(SmsGatewayInterface::class, $gateway);

    [$notification, $template] = makeSmsFixtures();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeTrue()
        ->and($result->latencyMs)->toBeGreaterThanOrEqual(0)
        ->and($result->providerResponse['mobile'])->toBe('+15551234567');
});

it('returns a transient failure for a RuntimeException from the gateway', function (): void {
    $gateway = m::mock(SmsGatewayInterface::class);
    $gateway->shouldReceive('send')
        ->once()
        ->andThrow(new RuntimeException('Twilio 503: backend overload'));

    $this->app->instance(SmsGatewayInterface::class, $gateway);

    [$notification, $template] = makeSmsFixtures();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeTrue()
        ->and($result->error)->toContain('503');
});

it('returns a permanent failure for a non-RuntimeException from the gateway', function (): void {
    $gateway = m::mock(SmsGatewayInterface::class);
    $gateway->shouldReceive('send')
        ->once()
        ->andThrow(new InvalidArgumentException('mobile is not E.164'));

    $this->app->instance(SmsGatewayInterface::class, $gateway);

    [$notification, $template] = makeSmsFixtures();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toBe('mobile is not E.164');
});

it('returns a permanent failure when the user has been deleted', function (): void {
    $template = makeSmsTemplate();
    $user = User::factory()->create(['mobile' => '+15551234567']);
    $notification = new Notification([
        'user_id' => $user->id,
        'type' => 'report.assigned',
        'channel' => 'sms',
        'payload' => ['report_id' => (string) Str::uuid()],
        'status' => 'pending',
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    $user->forceDelete();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->success)->toBeFalse()
        ->and($result->isTransient)->toBeFalse()
        ->and($result->error)->toBe('user not found');
});

it('always returns a ChannelResult (never throws)', function (): void {
    $gateway = m::mock(SmsGatewayInterface::class);
    $gateway->shouldReceive('send')->andReturnNull();
    $this->app->instance(SmsGatewayInterface::class, $gateway);

    [$notification, $template] = makeSmsFixtures();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result)->toBeInstanceOf(ChannelResult::class);
});

it('exposes the gateway driver in the provider_response on success', function (): void {
    $gateway = m::mock(SmsGatewayInterface::class);
    $gateway->shouldReceive('send')->andReturnNull();
    $this->app->instance(SmsGatewayInterface::class, $gateway);

    [$notification, $template] = makeSmsFixtures();

    $channel = app(SmsChannel::class);
    $result = $channel->send($notification, $template);

    expect($result->providerResponse)->toHaveKey('gateway')
        ->and($result->providerResponse['gateway'])->toContain('Mockery');
});

/**
 * @return array{0: Notification, 1: NotificationTemplate}
 */
function makeSmsFixtures(): array
{
    return [makeSmsNotification(), makeSmsTemplate()];
}

function makeSmsTemplate(): NotificationTemplate
{
    $template = new NotificationTemplate([
        'code' => 'report.assigned',
        'name' => 'Report Assigned',
        'channel' => 'sms',
        'subject' => null,
        'body' => 'Body text',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ]);
    $template->id = (string) Str::uuid();
    $template->save();

    return $template;
}

function makeSmsNotification(): Notification
{
    $user = User::factory()->create(['mobile' => '+15551234567']);

    $notification = new Notification([
        'user_id' => $user->id,
        'type' => 'report.assigned',
        'channel' => 'sms',
        'payload' => ['report_id' => (string) Str::uuid()],
        'status' => 'pending',
        'retry_count' => 0,
    ]);
    $notification->id = (string) Str::uuid();
    $notification->save();

    return $notification;
}
