<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use Illuminate\Http\Client\Factory as HttpFactory;
use Throwable;

/**
 * Webhook channel: POSTs a JSON envelope to a configured
 * inbound URL with an HMAC-SHA256 signature header.
 *
 * The webhook URL is per-notification-type. The dispatcher
 * looks it up from `config('notifications.webhooks.<code>')`
 * (or reads it directly from the notification payload's
 * `webhook_url` override). A failed lookup → permanent fail.
 *
 * The HMAC secret is read from
 * `config('notifications.webhook_secret')`; the signature
 * header is `X-CIP-Signature: sha256=<hex>` and a
 * `X-CIP-Timestamp` header carries the unix timestamp so
 * the receiver can reject replays.
 *
 * Response handling:
 *  - HTTP 2xx       → success
 *  - HTTP 4xx       → permanent (payload / signature bad)
 *  - HTTP 5xx       → transient (retry)
 *  - network error  → transient
 */
class WebhookChannel implements ChannelInterface
{
    public function __construct(private readonly HttpFactory $http) {}

    public function send(Notification $notification, NotificationTemplate $template): ChannelResult
    {
        $start = hrtime(true);

        $payload = (array) ($notification->payload ?? []);
        $url = $payload['webhook_url'] ?? $this->resolveUrlForType((string) $notification->type);
        $secret = (string) config('notifications.webhook_secret', '');

        if (! is_string($url) || $url === '') {
            return ChannelResult::fail(
                error: 'webhook url not configured for notification type',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $body = [
            'id' => (string) $notification->id,
            'type' => (string) $notification->type,
            'channel' => 'webhook',
            'template' => [
                'code' => (string) $template->code,
                'subject' => $template->subject,
                'body' => $template->body,
            ],
            'payload' => $payload,
            'created_at' => optional($notification->created_at)?->toIso8601String(),
        ];

        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp.'.'.json_encode($body, JSON_THROW_ON_ERROR), $secret);

        try {
            $response = $this->http
                ->withHeaders([
                    'X-CIP-Timestamp' => $timestamp,
                    'X-CIP-Signature' => 'sha256='.$signature,
                    'X-CIP-Event' => (string) $notification->type,
                ])
                ->acceptJson()
                ->asJson()
                ->timeout(10)
                ->post($url, $body);

            $latencyMs = $this->elapsedMs($start);
            $status = $response->status();

            if ($status >= 200 && $status < 300) {
                return ChannelResult::ok(
                    latencyMs: $latencyMs,
                    providerResponse: [
                        'url' => $url,
                        'status' => $status,
                        'response' => $response->json() ?? null,
                    ],
                );
            }

            $permanent = $status >= 400 && $status < 500;

            return ChannelResult::fail(
                error: $permanent
                    ? "webhook {$status} (permanent)"
                    : "webhook {$status} (transient)",
                transient: ! $permanent,
                latencyMs: $latencyMs,
                providerResponse: [
                    'url' => $url,
                    'status' => $status,
                    'body' => $response->body(),
                ],
            );
        } catch (Throwable $e) {
            return ChannelResult::fail(
                error: $e->getMessage(),
                transient: true,
                latencyMs: $this->elapsedMs($start),
                providerResponse: ['url' => $url],
            );
        }
    }

    private function resolveUrlForType(string $type): ?string
    {
        $map = (array) config('notifications.webhooks', []);

        return isset($map[$type]) && is_string($map[$type]) ? $map[$type] : null;
    }

    private function elapsedMs(int $startNs): int
    {
        return (int) ((hrtime(true) - $startNs) / 1_000_000);
    }
}
