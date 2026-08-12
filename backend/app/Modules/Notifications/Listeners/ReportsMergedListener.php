<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Moderation\Events\ReportsMerged;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * P1-07 — notifies the citizen of each duplicate report that
 * their report has been merged into a canonical case. This
 * preserves the "supporter relationship": the duplicate's citizen
 * learns the canonical tracking number and continues to receive
 * status updates from the canonical case.
 */
class ReportsMergedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(ReportsMerged $event): void
    {
        $canonical = Report::query()->find($event->canonicalReportId);

        if ($canonical === null) {
            return;
        }

        foreach ($event->duplicateReportIds as $duplicateId) {
            $duplicate = Report::query()->find($duplicateId);

            if ($duplicate === null) {
                continue;
            }

            if ($duplicate->citizen_id === null || $duplicate->citizen_id === '') {
                continue;
            }

            $user = User::query()->find($duplicate->citizen_id);

            if ($user === null) {
                continue;
            }

            try {
                $this->dispatcher->dispatch($user, 'report.merged', [
                    'name' => (string) ($user->name ?? ''),
                    'duplicate_tracking_number' => $duplicate->tracking_number,
                    'duplicate_title' => $duplicate->title,
                    'canonical_tracking_number' => $canonical->tracking_number,
                    'canonical_title' => $canonical->title,
                ], null, [
                    'channel' => 'email',
                ]);
            } catch (Throwable $e) {
                $this->recordFailure($user, 'report.merged', $e);
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
            Log::warning('failed to dispatch report.merged notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'log_error' => $logError->getMessage(),
            ]);
        }
    }
}
