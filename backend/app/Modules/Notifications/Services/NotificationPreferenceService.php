<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Users\Models\User;

/**
 * Reads + writes the per-(user, channel, event_code)
 * opt-in flag.
 *
 * The dispatcher queries `isEnabled(user, channel, event)`
 * before creating the row; the REST controller calls
 * `setEnabled(user, channel, event, bool)` for writes.
 */
class NotificationPreferenceService
{
    /**
     * Returns true when the user has NOT opted out of
     * the (channel, event) combination.
     */
    public function isEnabled(User $user, string $channel, string $eventCode): bool
    {
        $row = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('channel', $channel)
            ->where('event_code', $eventCode)
            ->first();

        if ($row === null) {
            return $this->defaultOptIn($eventCode);
        }

        return (bool) $row->enabled;
    }

    /**
     * Persist (or update) a preference row. Idempotent.
     */
    public function setEnabled(User $user, string $channel, string $eventCode, bool $enabled): NotificationPreference
    {
        return NotificationPreference::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'channel' => $channel,
                'event_code' => $eventCode,
            ],
            ['enabled' => $enabled],
        );
    }

    /**
     * Return all preferences for a user as a flat array of
     * { channel, event_code, enabled } dicts.
     *
     * @return list<array<string, mixed>>
     */
    public function allForUser(User $user): array
    {
        return NotificationPreference::query()
            ->where('user_id', $user->id)
            ->orderBy('channel')
            ->orderBy('event_code')
            ->get()
            ->map(static fn (NotificationPreference $p): array => [
                'channel' => $p->channel,
                'event_code' => $p->event_code,
                'enabled' => (bool) $p->enabled,
            ])
            ->all();
    }

    /**
     * Platform default: in V1 every event defaults to opt-in.
     * Marketing-style events (none yet) would default to opt-out.
     */
    private function defaultOptIn(string $eventCode): bool
    {
        return true;
    }
}
