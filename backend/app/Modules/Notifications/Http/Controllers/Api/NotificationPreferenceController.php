<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Api;

use App\Modules\Notifications\Services\NotificationPreferenceService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Citizen notification preferences.
 *
 *  - GET /api/v1/notifications/preferences      list the caller's prefs
 *  - PUT /api/v1/notifications/preferences      bulk-upsert prefs
 *
 * The `code` is the event code (e.g. `report.assigned`).
 * The `channel` is one of `push | email | sms | webhook`.
 *
 * The dispatcher reads the preference service before
 * creating a row, so a `enabled = false` row suppresses
 * the notification entirely.
 */
class NotificationPreferenceController extends BaseController
{
    private const CHANNELS = ['push', 'email', 'sms', 'webhook'];

    public function __construct(private readonly NotificationPreferenceService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        return $this->respond([
            'preferences' => $this->service->allForUser($user),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $data = $request->validate([
            'preferences' => ['required', 'array', 'min:1'],
            'preferences.*.channel' => ['required', 'string', Rule::in(self::CHANNELS)],
            'preferences.*.event_code' => ['required', 'string', 'max:64'],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);

        $saved = [];

        foreach ($data['preferences'] as $row) {
            $saved[] = $this->service->setEnabled(
                $user,
                $row['channel'],
                $row['event_code'],
                (bool) $row['enabled'],
            );
        }

        return $this->respond([
            'preferences' => $this->service->allForUser($user),
        ]);
    }
}
