<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Translates a `ReportStatusChanged` event into a citizen
 * notification. The template code is `report.status_changed`
 * with the from/to status codes as variables.
 */
class ReportStatusChangedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(ReportStatusChanged $event): void
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
            $this->dispatcher->dispatch($user, 'report.status_changed', [
                'report_id' => $report->id,
                'tracking_number' => $report->tracking_number,
                'title' => $report->title,
                'from_status' => $event->fromStatusId,
                'to_status' => $event->toStatusId,
                'actor' => $event->actorId,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            try {
                Log::warning('failed to dispatch report.status_changed notification', [
                    'report_id' => $event->reportId,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable) {
                // ignore
            }
        }
    }
}
