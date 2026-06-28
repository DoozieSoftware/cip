<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Channels\LogChannel;
use App\Modules\Notifications\Channels\MailChannel;
use App\Modules\Notifications\Channels\PushChannel;
use App\Modules\Notifications\Channels\SmsChannel;
use App\Modules\Notifications\Channels\WebhookChannel;
use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationLog;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Security\Models\AuditLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * Queueable job that delivers a single `Notification` row
 * through its channel implementation.
 *
 * The job is dispatched by `NotificationDispatcher::dispatch()`
 * and re-dispatched automatically on transient failure up to
 * `tries = 5` with backoff `[60, 300, 900, 3600]` seconds
 * (1m, 5m, 15m, 60m). On the 6th attempt the job marks
 * the row `dead` and emits an `audit_logs` entry.
 *
 * Every attempt writes a `notification_logs` row with the
 * channel, status, provider response, and latency.
 */
class SendNotificationJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** @var int Max attempts (initial + retries). */
    public int $tries = 5;

    /** @var int Hard cap on execution time (seconds). */
    public int $timeout = 30;

    /**
     * Backoff schedule (seconds). Index = attempt number - 1.
     * 1m, 5m, 15m, 60m.
     *
     * @var list<int>
     */
    public array $backoff = [60, 300, 900, 3600];

    public function __construct(public readonly string $notificationId) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return $this->backoff;
    }

    public function handle(): void
    {
        $notification = Notification::query()->find($this->notificationId);

        if ($notification === null) {
            Log::channel('notifications')->warning('notification missing in job', [
                'notification_id' => $this->notificationId,
            ]);

            return;
        }

        if ($notification->status === Notification::STATUS_DEAD) {
            // Already exhausted — nothing to do.
            return;
        }

        $template = $notification->payload['template_id'] ?? null;
        $templateRow = is_string($template) && $template !== ''
            ? NotificationTemplate::query()->find($template)
            : null;

        if ($templateRow === null) {
            $this->markDead($notification, 'template not found for notification');

            return;
        }

        $channel = $this->resolveChannel((string) $notification->channel);
        $result = $channel->send($notification, $templateRow);

        NotificationLog::query()->create([
            'notification_id' => $notification->id,
            'channel' => $notification->channel,
            'status' => $result->success ? 'sent' : 'failed',
            'provider_response' => $result->toArray(),
            'latency_ms' => $result->latencyMs,
            'attempted_at' => now(),
        ]);

        if ($result->success) {
            $notification->status = Notification::STATUS_SENT;
            $notification->read_at = null;
            $notification->last_error = null;
            $notification->save();

            return;
        }

        $notification->last_error = $result->error;
        $notification->retry_count = (int) $notification->retry_count + 1;

        if ($result->isTransient && $notification->retry_count < $this->tries) {
            $notification->status = Notification::STATUS_FAILED;
            $notification->save();

            // Re-throw to let the queue worker re-dispatch with backoff.
            throw new RuntimeException(
                "Transient notification failure (attempt {$notification->retry_count}/{$this->tries}): {$result->error}",
            );
        }

        $this->markDead($notification, $result->error ?? 'unknown');
    }

    public function failed(Throwable $e): void
    {
        $notification = Notification::query()->find($this->notificationId);

        if ($notification !== null) {
            $this->markDead($notification, $e->getMessage());
        }
    }

    private function markDead(Notification $notification, string $error): void
    {
        $notification->status = Notification::STATUS_DEAD;
        $notification->last_error = $error;
        $notification->save();

        AuditLog::query()->create([
            'user_id' => $notification->user_id,
            'entity' => 'notification',
            'entity_id' => $notification->id,
            'action' => 'notification.dead_letter',
            'before' => null,
            'after' => [
                'error' => $error,
                'retry_count' => (int) $notification->retry_count,
                'channel' => $notification->channel,
                'type' => $notification->type,
            ],
            'ip' => null,
            'device_fingerprint' => null,
            'request_id' => null,
            'created_at' => now(),
        ]);
    }

    private function resolveChannel(string $channelName): ChannelInterface
    {
        return match ($channelName) {
            'push' => app(PushChannel::class),
            'email' => app(MailChannel::class),
            'sms' => app(SmsChannel::class),
            'webhook' => app(WebhookChannel::class),
            'log' => app(LogChannel::class),
            default => throw new InvalidArgumentException("Unknown notification channel: {$channelName}"),
        };
    }
}
