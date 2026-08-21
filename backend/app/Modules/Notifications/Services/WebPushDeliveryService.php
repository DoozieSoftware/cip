<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

class WebPushDeliveryService
{
    /** @param array<string, mixed> $data */
    public function send(User $user, string $title, string $body, string $url, array $data = []): bool
    {
        $config = (array) config('notifications.vapid', []);
        $publicKey = $this->configString($config, 'public_key');
        $privateKey = $this->configString($config, 'private_key');
        $subject = $this->configString($config, 'subject');
        $subscriptions = PushSubscription::query()->where('user_id', $user->id)->get();

        if ($publicKey === '' || $privateKey === '' || $subject === '' || $subscriptions->isEmpty()) {
            Log::channel('notifications')->warning('web push delivery is not configured or has no subscription', [
                'user_id' => (string) $user->id,
                'public_key_configured' => $publicKey !== '',
                'private_key_configured' => $privateKey !== '',
                'subject_configured' => $subject !== '',
                'subscription_count' => $subscriptions->count(),
            ]);

            return false;
        }

        try {
            $webPush = new WebPush(['VAPID' => [
                'subject' => $subject,
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ]], ['TTL' => 300], 10);
            $payload = json_encode([
                'title' => $title,
                'body' => $body,
                'url' => $url,
                'tag' => 'cip-login-approval',
                'data' => $data,
            ], JSON_THROW_ON_ERROR);

            foreach ($subscriptions as $subscription) {
                $webPush->queueNotification(Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'keys' => $subscription->keys,
                    'contentEncoding' => $subscription->content_encoding ?? 'aes128gcm',
                ]), $payload);
            }

            $sent = 0;
            $pruned = [];
            $failures = [];

            foreach ($webPush->flush() as $report) {
                if (! $report instanceof MessageSentReport) {
                    continue;
                }

                if ($report->isSuccess()) {
                    $sent++;
                } else {
                    $reason = $report->getReason();
                    $vapidMismatch = str_contains($reason, 'VAPID credentials');
                    $failures[] = [
                        'code' => $vapidMismatch ? 'vapid_key_mismatch' : 'provider_rejected',
                        'status' => $report->getResponse()?->getStatusCode(),
                    ];

                    // A 403 "VAPID credentials" rejection is permanent for
                    // that subscription: it was created against a different
                    // application server key (keypair rotation or a stale
                    // build-time key). The provider will reject it on every
                    // future send, so prune it together with the expired
                    // endpoints instead of retrying dead rows forever.
                    if ($vapidMismatch || $report->isSubscriptionExpired()) {
                        $pruned[] = $report->getEndpoint();
                    }
                }
            }

            if ($pruned !== []) {
                PushSubscription::query()->where('user_id', $user->id)->whereIn('endpoint', $pruned)->delete();
            }

            if ($sent === 0) {
                Log::channel('notifications')->warning('web push provider rejected every delivery', [
                    'user_id' => (string) $user->id,
                    'failures' => $failures,
                ]);
            }

            return $sent > 0;
        } catch (Throwable $exception) {
            Log::channel('notifications')->warning('push login delivery failed', [
                'user_id' => (string) $user->id,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    /** @param array<mixed, mixed> $config */
    private function configString(array $config, string $key): string
    {
        $value = $config[$key] ?? '';

        return is_string($value) ? $value : '';
    }
}
