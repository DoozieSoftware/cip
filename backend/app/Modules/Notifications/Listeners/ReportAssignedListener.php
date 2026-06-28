<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Translates a `ReportAssigned` event into a citizen
 * notification. The template code is `report.assigned`;
 * the recipient is the report's citizen (or skip when
 * the report was filed anonymously).
 *
 * Any dispatcher exception is logged but does NOT
 * bubble — the assignment is the source of truth and
 * the notification is a downstream side effect.
 */
class ReportAssignedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(ReportAssigned $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null) {
            return;
        }

        if ($report->citizen_id === null || $report->citizen_id === '') {
            // Anonymous report — no recipient.
            return;
        }

        $user = User::query()->find($report->citizen_id);

        if ($user === null) {
            return;
        }

        try {
            $this->dispatcher->dispatch($user, 'report.assigned', [
                'report_id' => $report->id,
                'tracking_number' => $report->tracking_number,
                'title' => $report->title,
                'department' => $event->departmentId,
                'officer' => $event->officerId,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            // Swallow log failures too — the assignment is
            // the source of truth.
            try {
                Log::warning('failed to dispatch report.assigned notification', [
                    'report_id' => $event->reportId,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable) {
                // ignore
            }
        }
    }
}
