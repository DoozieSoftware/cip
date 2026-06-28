<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Api;

use App\Modules\Notifications\Http\Resources\NotificationResource;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Citizen notification inbox.
 *
 *  - GET    /api/v1/notifications         list the authenticated
 *                                          user's notifications
 *  - POST   /api/v1/notifications/{id}/read
 *                                          mark a single row as read
 *
 * Only the caller's own notifications are visible — there
 * is no admin override endpoint in V1 (Super Admin
 * audit-log access lands in M12).
 */
class NotificationsController extends BaseController
{
    /**
     * GET /api/v1/notifications
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $cursor = $request->query('cursor');

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->query('unread') === '1' || $request->query('unread') === 'true') {
            $query->whereNull('read_at');
        }

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        if ($cursor !== null && is_string($cursor)) {
            $query->where('created_at', '<', base64_decode($cursor, true) ?: '1970-01-01');
        }

        $rows = $query->cursorPaginate($perPage);

        $items = collect($rows->items())->map(
            static fn (Notification $n) => (new NotificationResource($n))->toArray($request),
        )->all();

        $nextCursor = $rows->hasMorePages() && count($rows->items()) > 0
            ? base64_encode((string) $rows->items()[count($rows->items()) - 1]->created_at?->toIso8601String())
            : null;

        return $this->respond([
            'items' => $items,
            'next_cursor' => $nextCursor,
            'unread_count' => Notification::query()->where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    /**
     * POST /api/v1/notifications/{id}/read
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $notification = Notification::query()->where('id', $id)->where('user_id', $user->id)->first();

        if ($notification === null) {
            return $this->respondError('Notification not found.', 404, 'NOT_FOUND');
        }

        if ($notification->read_at === null) {
            $notification->read_at = now();
            $notification->save();
        }

        return $this->respond([
            'id' => (string) $notification->id,
            'read_at' => $notification->read_at?->toIso8601String(),
        ]);
    }
}
