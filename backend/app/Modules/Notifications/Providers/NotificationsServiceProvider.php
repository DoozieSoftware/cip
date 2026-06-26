<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Providers;

use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use App\Modules\Notifications\Drivers\LogSmsGateway;
use Illuminate\Support\ServiceProvider;

/**
 * Notifications module service provider.
 *
 * - Binds SmsGatewayInterface to the configured driver
 *   (`config('cip.notifications.sms_driver')`). Default = 'log'.
 * - The driver registry is intentionally tiny in V1 — only `log` is
 *   shipped. M14 (External Connector Framework) will introduce the
 *   provider-discovery mechanism and the real driver implementations.
 */
class NotificationsServiceProvider extends ServiceProvider
{
    /**
     * @var array<string, class-string<SmsGatewayInterface>>
     */
    public const DRIVERS = [
        'log' => LogSmsGateway::class,
    ];

    public function register(): void
    {
        $this->app->singleton(SmsGatewayInterface::class, function (): SmsGatewayInterface {
            $rawDriver = config('cip.notifications.sms_driver', 'log');
            $driver = is_string($rawDriver) ? $rawDriver : 'log';
            $class = self::DRIVERS[$driver] ?? LogSmsGateway::class;

            return new $class;
        });
    }
}
