<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Models\Report;
use App\Modules\Workflow\Events\SlaBreached;
use Illuminate\Support\Facades\Log;
use Throwable;

class SlaBreachedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(SlaBreached $event): void
    {
        $report = Report::query()->with(['department.users'])->find($event->reportId);

        if ($report === null || $report->department === null) {
            return;
        }

        $transition = $event->overdueTransitions[0] ?? [];
        $eventName = is_string($transition['event'] ?? null) ? $transition['event'] : 'workflow action';

        foreach ($report->department->users as $user) {
            try {
                $this->dispatcher->dispatch($user, 'report.sla_breached', [
                    'name' => (string) ($user->name ?? ''),
                    'tracking_number' => $report->tracking_number,
                    'title' => $report->title,
                    'event' => $eventName,
                    'elapsed_minutes' => (string) $event->elapsedMinutes,
                ], null, ['channel' => 'email']);
            } catch (Throwable $exception) {
                try {
                    Notification::query()->create([
                        'user_id' => $user->id,
                        'type' => 'report.sla_breached',
                        'channel' => 'email',
                        'payload' => ['error' => $exception->getMessage()],
                        'status' => Notification::STATUS_DEAD,
                        'last_error' => $exception->getMessage(),
                        'retry_count' => 0,
                    ]);
                } catch (Throwable $logError) {
                    Log::warning('failed to persist SLA breach notification failure', [
                        'user_id' => $user->id,
                        'error' => $logError->getMessage(),
                    ]);
                }
            }
        }
    }
}
