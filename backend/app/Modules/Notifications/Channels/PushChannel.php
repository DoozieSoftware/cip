<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Log;
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
        $endpoint = (string) ($config['endpoint'] ?? '');
        $bearer = (string) ($config['access_token'] ?? '');
        $project = (string) ($config['project_id'] ?? '');

        if ($endpoint === '' || $bearer === '' || $project === '') {
            return ChannelResult::fail(
                error: 'fcm.push_not_configured — set FCM_ENDPOINT, FCM_PROJECT_ID, FCM_ACCESS_TOKEN',
                transient: false,
                latencyMs: $this->elapsedMs($start),
            );
        }

        $token = $this->resolveDeviceToken($notification);

        if ($token === null) {
            return ChannelResult::fail(
                error: 'notification payload missing device token',
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
                        'message_name' => (string) ($response->json('name') ?? ''),
                        'status' => $status,
                    ],
                );
            }

            // 4xx is permanent for v1 (token / payload bad) — the FCM
            // contract returns the error code in the response body.
            $errorCode = (string) ($response->json('error.details.0.errorCode') ?? '');
            $permanent = $status >= 400 && $status < 500;

            if ($permanent) {
                Log::channel('notifications')->warning('fcm push rejected', [
                    'notification_id' => $notification->id,
                    'status' => $status,
                    'error_code' => $errorCode,
                ]);
            }

            return ChannelResult::fail(
                error: $errorCode !== '' ? $errorCode : "fcm http {$status}",
                transient: ! $permanent,
                latencyMs: $latencyMs,
                providerResponse: $response->json() ?? [],
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

    private function elapsedMs(int $startNs): int
    {
        return (int) ((hrtime(true) - $startNs) / 1_000_000);
    }
}
