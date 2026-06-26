<?php

declare(strict_types=1);

use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use App\Modules\Notifications\Drivers\LogSmsGateway;
use App\Modules\Notifications\Providers\NotificationsServiceProvider;
use Illuminate\Support\Facades\Log;

/**
 * Validates the LogSmsGateway and the service-container binding
 * introduced in T-M2-012.
 */
it('LogSmsGateway implements SmsGatewayInterface', function (): void {
    $driver = new LogSmsGateway;
    expect($driver)->toBeInstanceOf(SmsGatewayInterface::class);
});

it('writes the SMS to the configured log channel with mobile + gateway', function (): void {
    Log::shouldReceive('channel')
        ->once()
        ->with('sms')
        ->andReturnSelf();

    Log::shouldReceive('info')
        ->once()
        ->with('Hello, citizen!', [
            'mobile' => '9876543210',
            'gateway' => 'log',
        ]);

    $driver = new LogSmsGateway('sms');
    $driver->send('9876543210', 'Hello, citizen!');
});

it('respects a custom log channel via constructor', function (): void {
    Log::shouldReceive('channel')
        ->once()
        ->with('custom-sms')
        ->andReturnSelf();

    Log::shouldReceive('info')
        ->once()
        ->with('msg', ['mobile' => '9999999999', 'gateway' => 'log']);

    (new LogSmsGateway('custom-sms'))->send('9999999999', 'msg');
});

it('is bound to SmsGatewayInterface as a singleton via the provider', function (): void {
    $provider = new NotificationsServiceProvider(app());
    $provider->register();

    $a = app(SmsGatewayInterface::class);
    $b = app(SmsGatewayInterface::class);

    expect($a)->toBeInstanceOf(LogSmsGateway::class)
        ->and($b)->toBe($a); // singleton
});

it('falls back to LogSmsGateway for unknown driver names', function (): void {
    config(['cip.notifications.sms_driver' => 'non-existent-provider']);

    $provider = new NotificationsServiceProvider(app());
    $provider->register();

    expect(app(SmsGatewayInterface::class))->toBeInstanceOf(LogSmsGateway::class);
});

it('respects the cip.notifications.sms_driver config', function (): void {
    config(['cip.notifications.sms_driver' => 'log']);
    $provider = new NotificationsServiceProvider(app());
    $provider->register();

    expect(app(SmsGatewayInterface::class))->toBeInstanceOf(LogSmsGateway::class);
});
