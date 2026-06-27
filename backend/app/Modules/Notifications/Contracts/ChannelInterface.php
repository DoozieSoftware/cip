<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;

/**
 * Contract for a notification delivery channel
 * (push, email, sms, webhook).
 *
 * Per docs/03 §17 every channel implementation MUST:
 *  - return a ChannelResult (never throw on transient errors —
 *    transient errors are a `success = false` ChannelResult so
 *    the dispatcher can decide whether to retry)
 *  - record the provider response in the result
 *  - measure and report latency_ms
 *  - be safe to invoke from a queue worker
 *  - NOT depend on the HTTP request lifecycle
 *
 * Channels are stateless; all per-delivery state lives on
 * the Notification and the ChannelResult.
 */
interface ChannelInterface
{
    /**
     * Deliver a single notification.
     *
     * @return ChannelResult The delivery outcome. `success = false`
     *                       for transient failures; fatal errors
     *                       (e.g. invalid number) MAY throw.
     */
    public function send(Notification $notification, NotificationTemplate $template): ChannelResult;
}
