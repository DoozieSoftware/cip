<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use Illuminate\Support\Facades\Log;

/**
 * Dev-only default channel: writes the rendered
 * notification to the `notifications` log channel.
 *
 * Used in dev, CI, and the demo deployment where no real
 * provider is configured. The dispatcher falls back to
 * this channel automatically when no real channel
 * binding exists.
 *
 * The implementation is intentionally trivial — it just
 * logs and reports success with the measured latency.
 */
class LogChannel implements ChannelInterface
{
    public function __construct(
        private readonly string $logChannel = 'notifications',
    ) {}

    public function send(Notification $notification, NotificationTemplate $template): ChannelResult
    {
        $start = hrtime(true);

        Log::channel($this->logChannel)->info('notification.dispatched', [
            'notification_id' => $notification->id,
            'user_id' => $notification->user_id,
            'type' => $notification->type,
            'channel' => $notification->channel,
            'template_code' => $template->code,
            'template_locale' => $template->locale,
            'template_version' => $template->version,
            'payload' => $notification->payload,
        ]);

        $latencyMs = (int) ((hrtime(true) - $start) / 1_000_000);

        return ChannelResult::ok(
            latencyMs: $latencyMs,
            providerResponse: ['driver' => 'log', 'log_channel' => $this->logChannel],
        );
    }
}
