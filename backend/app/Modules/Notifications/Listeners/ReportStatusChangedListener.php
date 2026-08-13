<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

class ReportStatusChangedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(ReportStatusChanged $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            return;
        }

        $fromStatusName = '';

        if ($event->fromStatusId !== null) {
            $from = ReportStatus::query()->whereKey($event->fromStatusId)->value('name');
            $fromStatusName = is_string($from) ? $from : '';
        }

        $to = ReportStatus::query()->whereKey($event->toStatusId)->value('name');
        $toStatusName = is_string($to) ? $to : '';

        $citizenIds = collect([$report->citizen_id])
            ->merge(Report::query()
                ->where('merged_into', $report->id)
                ->where('is_anonymous', false)
                ->whereNotNull('citizen_id')
                ->pluck('citizen_id'))
            ->filter(static fn (mixed $id): bool => is_string($id) && $id !== '')
            ->unique()
            ->values();

        foreach (User::query()->whereKey($citizenIds)->get() as $user) {
            try {
                $this->dispatcher->dispatch($user, 'report.status_changed', [
                    'report_id' => $report->id,
                    'name' => (string) ($user->name ?? ''),
                    'tracking_number' => $report->tracking_number,
                    'title' => $report->title,
                    'from_status' => $fromStatusName,
                    'to_status' => $toStatusName,
                ], null, [
                    'channel' => 'email',
                ]);
            } catch (Throwable $e) {
                $this->recordFailure($user, 'report.status_changed', $e);
            }
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
            Log::warning('failed to dispatch report.status_changed notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'log_error' => $logError->getMessage(),
            ]);
        }
    }
}
