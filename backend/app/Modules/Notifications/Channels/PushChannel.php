<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * FCM (Firebase Cloud Messaging) HTTP v1 push channel.
 *
 * Sends a single message to one device token via the
 * FCM HTTP v1 endpoint. The auth + project wiring is read
 * from `config('notifications.fcm')` and the actual
 * OAuth2 service-account exchange is left to the
 * operations team (the FCM project id, the service
 * account JSON path, and the access-token cache are
 * all config-driven).
 *
 * Per docs/03 §17:
 *  - HTTP 200 → success
 *  - HTTP 4xx with a NOT_VALIDATED / UNREGISTERED
 *    error code → permanent fail (token dead)
 *  - HTTP 4xx otherwise → permanent fail
 *  - HTTP 5xx / network timeout → transient fail
 */
class PushChannel implements ChannelInterface
{
    public function __construct(private readonly HttpFactory $http) {}

    public function send(Notification $notification, NotificationTemplate $template): ChannelResult
    {
        $start = hrtime(true);

        $config = (array) config('notifications.fcm', []);
        $endpoint = $this->configString($config, 'endpoint');
        $bearer = $this->configString($config, 'access_token');
        $project = $this->configString($config, 'project_id');

        $token = $this->resolveDeviceToken($notification);

        if ($token === null) {
            return $this->sendWebPush($notification, $template, $start);
        }

        if ($endpoint === '' || $bearer === '' || $project === '') {
            return ChannelResult::fail(
                error: 'fcm.push_not_configured — set FCM_ENDPOINT, FCM_PROJECT_ID, FCM_ACCESS_TOKEN',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $body = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $template->subject,
                    'body' => $template->body,
                ],
                'data' => array_merge((array) ($notification->payload ?? []), [
                    'notification_id' => (string) $notification->id,
                    'template_code' => (string) $template->code,
                ]),
            ],
        ];

        try {
            $response = $this->http
                ->withToken($bearer)
                ->acceptJson()
                ->asJson()
                ->timeout(10)
                ->post($endpoint, $body);

            $latencyMs = $this->elapsedMs($start);
            $status = $response->status();

            if ($status === 200) {
                return ChannelResult::ok(
                    latencyMs: $latencyMs,
                    providerResponse: [
                        'project' => $project,
                        'message_name' => $this->jsonString($response->json('name')),
                        'status' => $status,
                    ],
                );
            }

            // 4xx is permanent for v1 (token / payload bad) — the FCM
            // contract returns the error code in the response body.
            $errorCode = $this->jsonString($response->json('error.details.0.errorCode'));
            $permanent = $status >= 400 && $status < 500;

            if ($permanent) {
                Log::channel('notifications')->warning('fcm push rejected', [
                    'notification_id' => $notification->id,
                    'status' => $status,
                    'error_code' => $errorCode,
                ]);
            }

            $providerResponse = $response->json();

            return ChannelResult::fail(
                error: $errorCode !== '' ? $errorCode : "fcm http {$status}",
                transient: ! $permanent,
                latencyMs: $latencyMs,
                providerResponse: is_array($providerResponse) ? $providerResponse : [],
            );
        } catch (Throwable $e) {
            return ChannelResult::fail(
                error: $e->getMessage(),
                transient: true,
                latencyMs: $this->elapsedMs($start),
            );
        }
    }

    /**
     * Read the device token from the notification payload.
     * The FCM contract uses the `device_token` key; the
     * dispatcher / API surface must populate it on push.
     */
    private function resolveDeviceToken(Notification $notification): ?string
    {
        $payload = (array) ($notification->payload ?? []);
        $token = $payload['device_token'] ?? null;

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function sendWebPush(Notification $notification, NotificationTemplate $template, int $start): ChannelResult
    {
        $config = (array) config('notifications.vapid', []);
        $publicKey = $this->configString($config, 'public_key');
        $privateKey = $this->configString($config, 'private_key');
        $subject = $this->configString($config, 'subject');

        if ($publicKey === '' || $privateKey === '' || $subject === '') {
            return ChannelResult::fail(
                error: 'notification payload missing device token',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $subscriptions = PushSubscription::query()
            ->where('user_id', $notification->user_id)
            ->get();

        if ($subscriptions->isEmpty()) {
            return ChannelResult::fail(
                error: 'no active web push subscriptions',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => $subject,
                    'publicKey' => $publicKey,
                    'privateKey' => $privateKey,
                ],
            ], ['TTL' => 300], 10);
            $payload = json_encode([
                'title' => $template->subject,
                'body' => $template->body,
                'data' => array_merge((array) ($notification->payload ?? []), [
                    'notification_id' => (string) $notification->id,
                    'template_code' => (string) $template->code,
                ]),
                'notification_id' => (string) $notification->id,
            ], JSON_THROW_ON_ERROR);

            foreach ($subscriptions as $subscription) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $subscription->endpoint,
                        'keys' => $subscription->keys,
                        'contentEncoding' => $subscription->content_encoding ?? 'aes128gcm',
                    ]),
                    $payload,
                );
            }

            $sent = 0;
            $failed = 0;
            $expired = [];

            foreach ($webPush->flush() as $report) {
                if (! $report instanceof MessageSentReport) {
                    continue;
                }

                if ($report->isSuccess()) {
                    $sent++;
                } else {
                    $failed++;

                    if ($report->isSubscriptionExpired()) {
                        $expired[] = $report->getEndpoint();
                    }
                }
            }

            if ($expired !== []) {
                PushSubscription::query()
                    ->where('user_id', $notification->user_id)
                    ->whereIn('endpoint', $expired)
                    ->delete();
            }

            if ($sent > 0) {
                return ChannelResult::ok(
                    latencyMs: $this->elapsedMs($start),
                    providerResponse: ['provider' => 'web_push', 'sent' => $sent, 'failed' => $failed],
                );
            }

            return ChannelResult::fail(
                error: 'all web push deliveries failed',
                transient: true,
                latencyMs: $this->elapsedMs($start),
                providerResponse: ['provider' => 'web_push', 'sent' => 0, 'failed' => $failed],
            );
        } catch (Throwable $e) {
            Log::channel('notifications')->warning('web push delivery failed', [
                'notification_id' => (string) $notification->id,
                'error' => $e->getMessage(),
            ]);

            return ChannelResult::fail(
                error: $e->getMessage(),
                transient: true,
                latencyMs: $this->elapsedMs($start),
            );
        }
    }

    private function elapsedMs(int $startNs): int
    {
        return (int) ((hrtime(true) - $startNs) / 1_000_000);
    }

    /** @param array<mixed, mixed> $config */
    private function configString(array $config, string $key): string
    {
        $value = $config[$key] ?? null;

        return is_string($value) ? trim($value) : '';
    }

    private function jsonString(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
