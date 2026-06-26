<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Drivers;

use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use Illuminate\Support\Facades\Log;

/**
 * Logs the SMS to the `sms` log channel instead of dispatching it.
 *
 * This is the default driver for V1 environments (local, CI, demo)
 * and for tests. A real provider (Twilio, MSG91, AWS SNS, Gupshup)
 * is plugged in by binding a different implementation to
 * SmsGatewayInterface in a service provider — selection is driven by
 * `config('cip.notifications.sms_driver')`.
 */
class LogSmsGateway implements SmsGatewayInterface
{
    /**
     * @param  string  $channel  Log channel to write to. Defaults to `sms`.
     */
    public function __construct(
        private readonly string $channel = 'sms',
    ) {}

    public function send(string $mobile, string $message): void
    {
        Log::channel($this->channel)->info($message, [
            'mobile' => $mobile,
            'gateway' => 'log',
        ]);
    }
}
