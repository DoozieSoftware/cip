<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Departments\Models\Department;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

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
            return;
        }

        $user = User::query()->find($report->citizen_id);

        if ($user === null) {
            return;
        }

        $departmentName = Department::query()->whereKey($event->departmentId)->value('name');
        $departmentName = is_string($departmentName) ? $departmentName : '';
        $cityName = $report->location?->ward?->city?->name;
        $cityName = is_string($cityName) ? $cityName : '';

        try {
            $this->dispatcher->dispatch($user, 'report.assigned', [
                'name' => (string) ($user->name ?? ''),
                'tracking_number' => $report->tracking_number,
                'title' => $report->title,
                'department' => $departmentName,
                'city' => $cityName,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            $this->recordFailure($user, 'report.assigned', $e);
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
            Log::warning('failed to dispatch report.assigned notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'log_error' => $logError->getMessage(),
            ]);
        }
    }
}
