<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

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
                'name' => (string) ($user->name ?? ''),
                'event_type' => (string) ($event->event ?? ''),
                'ip' => (string) ($event->ip ?? ''),
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            $this->recordFailure($user, 'security.alert', $e);
        }
    }

    private function recordFailure(User $user, string $code, Throwable $e): void
    {
        try {
            Notification::query()->create([
                'user_id' => $user->id,
                'type' => $code,
                'channel' => 'email',
                'payload' => ['error' => $e->getMessage(), 'class' => $e::class],
                'status' => Notification::STATUS_DEAD,
                'last_error' => $e->getMessage(),
                'retry_count' => 0,
            ]);
        } catch (Throwable $logError) {
            Log::warning('failed to dispatch security.alert notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'log_error' => $logError->getMessage(),
            ]);
        }
    }
}
