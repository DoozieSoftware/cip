<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Contracts\SmsGatewayInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use App\Modules\Users\Models\User;
use Throwable;

/**
 * SMS channel: delegates to the bound SmsGatewayInterface.
 *
 * In V1 the registered driver is `LogSmsGateway` (writes to the
 * `sms` log channel). M14 (External Connector Framework) will
 * register a real provider driver (Twilio / MSG91 / AWS SNS /
 * Gupshup) — selection is driven by
 * `config('cip.notifications.sms_driver')`.
 *
 * The gateway contract allows both `void` returns and thrown
 * exceptions for fatal errors (invalid number). We translate
 * both into the ChannelResult enum:
 *  - gateway returns normally  -> success
 *  - gateway throws            -> permanent failure (the gateway
 *                                 has already validated; an exception
 *                                 means a hard stop)
 *
 * Transient failures (network, 5xx) are absorbed inside the
 * gateway driver and surfaced as an exception with a known
 * code; we map those to transient failures here.
 */
class SmsChannel implements ChannelInterface
{
    public function __construct(private readonly SmsGatewayInterface $gateway) {}

    public function send(Notification $notification, NotificationTemplate $template): ChannelResult
    {
        $start = hrtime(true);

        $user = User::find($notification->user_id);

        if ($user === null) {
            return ChannelResult::fail(
                error: 'user not found',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $mobile = $user->mobile ?? $user->phone ?? null;

        if (! is_string($mobile) || $mobile === '') {
            return ChannelResult::fail(
                error: 'user has no mobile number',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $message = (string) ($template->body ?? '');

        try {
            $this->gateway->send($mobile, $message);

            return ChannelResult::ok(
                latencyMs: $this->elapsedMs($start),
                providerResponse: [
                    'gateway' => $this->gatewayClass(),
                    'mobile' => $mobile,
                ],
            );
        } catch (Throwable $e) {
            // SmsGateway drivers signal transient failures as
            // RuntimeException; we treat anything else as fatal.
            $isTransient = $e instanceof \RuntimeException;

            return ChannelResult::fail(
                error: $e->getMessage(),
                transient: $isTransient,
                latencyMs: $this->elapsedMs($start),
                providerResponse: ['gateway' => $this->gatewayClass(), 'class' => $e::class],
            );
        }
    }

    private function gatewayClass(): string
    {
        return $this->gateway::class;
    }

    private function elapsedMs(int $startNs): int
    {
        return (int) ((hrtime(true) - $startNs) / 1_000_000);
    }
}
