<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Providers;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Notifications\Console\GenerateVapidKeys;
use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use App\Modules\Notifications\Drivers\LogSmsGateway;
use App\Modules\Notifications\Listeners\AiCompletedListener;
use App\Modules\Notifications\Listeners\ReportAssignedListener;
use App\Modules\Notifications\Listeners\ReportStatusChangedListener;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Events\ReportStatusChanged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class NotificationsServiceProvider extends ServiceProvider
{
    /**
     * @var array<string, class-string<SmsGatewayInterface>>
     */
    public const DRIVERS = [
        'log' => LogSmsGateway::class,
    ];

    public function boot(): void
    {
        Event::listen(ReportStatusChanged::class, ReportStatusChangedListener::class);
        Event::listen(ReportAssigned::class, ReportAssignedListener::class);
        Event::listen(AiCompleted::class, AiCompletedListener::class);
    }

    public function register(): void
    {
        $this->commands(GenerateVapidKeys::class);

        $this->app->singleton(SmsGatewayInterface::class, function (): SmsGatewayInterface {
            $rawDriver = config('cip.notifications.sms_driver', 'log');
            $driver = is_string($rawDriver) ? $rawDriver : 'log';
            $class = self::DRIVERS[$driver] ?? LogSmsGateway::class;

            return new $class;
        });
    }
}
