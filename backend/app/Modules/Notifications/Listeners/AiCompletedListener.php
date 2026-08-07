<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

class AiCompletedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(AiCompleted $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null || $report->citizen_id === null || $report->citizen_id === '') {
            return;
        }

        $user = User::query()->find($report->citizen_id);

        if ($user === null) {
            return;
        }

        try {
            $this->dispatcher->dispatch($user, 'ai.classified', [
                'name' => (string) ($user->name ?? ''),
                'tracking_number' => $report->tracking_number,
                'title' => $report->title,
                'ai_label' => (string) ($event->aiLabel ?? ''),
                'category' => (string) ($event->categoryCode ?? ''),
                'severity' => (string) ($event->severityCode ?? ''),
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            $this->recordFailure($user, 'ai.classified', $e);
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
            Log::warning('failed to dispatch ai.classified notification', [
                'report_id' => $user->id,
                'error' => $e->getMessage(),
                'log_error' => $logError->getMessage(),
            ]);
        }
    }
}
