<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Placeholder listener for the SecurityEvent domain.
 *
 * In V1 we route the `security.suspicious_login` event
 * to a `security.alert` notification for the affected
 * user. The actual event class lives in the Security
 * module — this listener is the wiring point.
 *
 * The listener tolerates a missing `SecurityEvent`
 * class (in environments where the security module is
 * not yet wired) by catching the resolution error.
 */
class SecurityEventListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(mixed $event): void
    {
        if (! $event instanceof SecurityEvent) {
            return;
        }

        $userId = $event->user_id ?? null;

        if (! is_string($userId) || $userId === '') {
            return;
        }

        $user = User::query()->find($userId);

        if ($user === null) {
            return;
        }

        try {
            $this->dispatcher->dispatch($user, 'security.alert', [
                'event_type' => (string) ($event->type ?? ''),
                'ip' => (string) ($event->ip ?? ''),
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            try {
                Log::warning('failed to dispatch security.alert notification', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable) {
                // ignore
            }
        }
    }
}
