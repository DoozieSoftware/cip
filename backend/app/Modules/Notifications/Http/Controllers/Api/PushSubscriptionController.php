<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Api;

use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Citizen Web Push subscriptions (T-M13).
 *
 *  - GET  /api/v1/notifications/push/vapid-public-key
 *        returns the VAPID public key the browser needs to subscribe
 *  - POST /api/v1/notifications/push/subscriptions
 *        stores (or replaces) the caller's push subscription
 *  - DEL  /api/v1/notifications/push/subscriptions/{endpoint}
 *        removes a subscription (e.g. on logout / unsubscribe)
 */
class PushSubscriptionController extends BaseController
{
    /**
     * GET /api/v1/notifications/push/vapid-public-key
     */
    public function vapidPublicKey(): JsonResponse
    {
        return $this->respond([
            'public_key' => (string) config('notifications.vapid.public_key', ''),
        ]);
    }

    /**
     * POST /api/v1/notifications/push/subscriptions
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:512'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', 'string', 'max:32'],
        ]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['user_id' => $user->id, 'endpoint' => $data['endpoint']],
            [
                'keys' => $data['keys'],
                'content_encoding' => $data['content_encoding'] ?? null,
            ],
        );

        return $this->respond([
            'id' => (string) $subscription->id,
            'endpoint' => $subscription->endpoint,
        ], 'Push subscription saved.', 201);
    }

    /**
     * DEL /api/v1/notifications/push/subscriptions?endpoint=...
     *
     * The push endpoint is a full URL that contains slashes, so it is
     * passed as a query parameter — putting it in the path breaks route
     * matching once percent-encoded slashes are decoded by the server.
     */
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $endpoint = (string) $request->query('endpoint', '');

        if ($endpoint === '') {
            return $this->respondError('Missing endpoint.', 422, 'VALIDATION_FAILED');
        }

        PushSubscription::query()
            ->where('user_id', $user->id)
            ->where('endpoint', $endpoint)
            ->delete();

        return $this->respond(null, 'Push subscription removed.');
    }
}
