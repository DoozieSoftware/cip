<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Per-department resolution rate and median resolution time for the
 * Public Portal (Vision §7 / PRD M7). Only `name`, `code`, and
 * aggregate counts leave this service — no internal notes, no
 * officer names, no citizen identity.
 */
class PublicDepartmentPerformanceService
{
    private const CACHE_KEY = 'public.department_performance';

    private const CACHE_TTL_SECONDS = 300;

    private const RESOLVED_CODES = ['resolved', 'verified', 'closed'];

    /**
     * @return array<int, array{id: string, name: string, code: string, total_reports: int, resolved_reports: int, resolution_rate_percent: float, median_resolution_hours: float|null}>
     */
    public function summary(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            $resolvedStatusIds = ReportStatus::query()
                ->whereIn('code', self::RESOLVED_CODES)
                ->pluck('id')
                ->all();

            return Department::query()
                ->where('active', true)
                ->get()
                ->map(function (Department $department) use ($resolvedStatusIds): ?array {
                    $total = Report::query()->where('department_id', $department->id)->whereNull('deleted_at')->count();

                    if ($total === 0) {
                        return null;
                    }

                    $resolved = Report::query()
                        ->where('department_id', $department->id)
                        ->whereNull('deleted_at')
                        ->whereIn('current_status_id', $resolvedStatusIds)
                        ->count();

                    return [
                        'id' => $department->id,
                        'name' => $department->name,
                        'code' => $department->code,
                        'total_reports' => $total,
                        'resolved_reports' => $resolved,
                        'resolution_rate_percent' => round(($resolved / $total) * 100, 1),
                        'median_resolution_hours' => $this->medianResolutionHours($department->id, $resolvedStatusIds),
                    ];
                })
                ->filter()
                ->values()
                ->all();
        });
    }

    private function medianResolutionHours(string $departmentId, array $resolvedStatusIds): ?float
    {
        $reports = Report::query()
            ->where('department_id', $departmentId)
            ->whereNull('deleted_at')
            ->whereIn('current_status_id', $resolvedStatusIds)
            ->whereNotNull('submitted_at')
            ->get(['id', 'submitted_at']);

        if ($reports->isEmpty()) {
            return null;
        }

        $resolvedAtByReport = [];

        foreach (
            ReportStatusHistory::query()
                ->whereIn('report_id', $reports->pluck('id'))
                ->whereIn('to_status_id', $resolvedStatusIds)
                ->orderBy('created_at')
                ->get(['report_id', 'created_at']) as $row
        ) {
            // First resolved-family transition per report (earliest wins).
            if (! isset($resolvedAtByReport[$row->report_id])) {
                $resolvedAtByReport[$row->report_id] = Carbon::parse($row->created_at);
            }
        }

        $hours = [];

        foreach ($reports as $report) {
            $resolvedAt = $resolvedAtByReport[$report->id] ?? null;
            $submittedAt = $report->submitted_at;

            if ($resolvedAt instanceof Carbon && $submittedAt instanceof Carbon) {
                $hours[] = abs($resolvedAt->diffInSeconds($submittedAt)) / 3600;
            }
        }

        if ($hours === []) {
            return null;
        }

        sort($hours);
        $count = count($hours);
        $mid = intdiv($count, 2);
        $median = $count % 2 === 0 ? ($hours[$mid - 1] + $hours[$mid]) / 2 : $hours[$mid];

        return round($median, 1);
    }
}
