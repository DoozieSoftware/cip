<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PublicAnalyticsAggregateService
{
    private const SAMPLE_SIZE = 500;

    public function rebuild(Carbon|string|null $date = null): void
    {
        $day = $date instanceof Carbon ? $date->toDateString() : (is_string($date) ? $date : today()->toDateString());
        $excluded = ['draft', 'rejected', 'merged'];
        $eligible = Report::query()
            ->whereDate('created_at', $day)
            ->whereHas('status', static fn ($query) => $query->whereNotIn('code', $excluded));

        $total = (int) (clone $eligible)->count();
        $classified = (int) (clone $eligible)->whereNotNull('ai_label')->count();
        $median = $this->medianAssignSeconds($day);

        DB::table('public_daily_metrics')->updateOrInsert(
            ['metric_date' => $day],
            [
                'total_reports' => $total,
                'ai_classified_reports' => $classified,
                'median_assign_seconds' => $median,
                'version' => 'v1',
                'generated_at' => now(),
            ],
        );

        $resolvedId = ReportStatus::query()->whereIn('code', ['resolved', 'closed'])->pluck('id')->all();
        $rows = DB::table('reports')
            ->join('report_statuses', 'report_statuses.id', '=', 'reports.current_status_id')
            ->join('locations', 'locations.id', '=', 'reports.location_id')
            ->whereDate('reports.created_at', $day)
            ->whereNotIn('report_statuses.code', $excluded)
            ->whereNotNull('locations.ward_id')
            ->selectRaw('locations.ward_id as ward_id, COUNT(*) as report_count')
            ->groupBy('locations.ward_id')
            ->get();

        foreach ($rows as $row) {
            $wardId = $row->ward_id;
            $reportCount = $row->report_count;

            if (! is_string($wardId) || ! is_numeric($reportCount)) {
                continue;
            }
            $resolved = (clone $eligible)
                ->join('locations', 'locations.id', '=', 'reports.location_id')
                ->where('locations.ward_id', $wardId)
                ->whereIn('reports.current_status_id', $resolvedId)
                ->count();
            DB::table('public_ward_daily_facts')->updateOrInsert(
                ['metric_date' => $day, 'ward_id' => $wardId],
                [
                    'report_count' => (int) $reportCount,
                    'resolved_count' => (int) $resolved,
                    'version' => 'v1',
                    'generated_at' => now(),
                ],
            );
        }
    }

    private function medianAssignSeconds(string $day): ?int
    {
        $submitted = ReportStatus::query()->where('code', 'submitted')->value('id');
        $assigned = ReportStatus::query()->where('code', 'assigned')->value('id');

        if (! is_string($submitted) || ! is_string($assigned)) {
            return null;
        }

        $assignments = ReportStatusHistory::query()->where('to_status_id', $assigned)->whereDate('created_at', $day)->latest()->limit(self::SAMPLE_SIZE)->get(['report_id', 'created_at']);
        $submittedAt = ReportStatusHistory::query()->where('to_status_id', $submitted)->whereIn('report_id', $assignments->pluck('report_id'))->pluck('created_at', 'report_id');
        $deltas = $assignments->map(static function ($row) use ($submittedAt): ?int {
            $start = $submittedAt[$row->report_id] ?? null;

            if ($start === null || ! is_string($start) || ! is_string($row->created_at)) {
                return null;
            }

            return abs((int) Carbon::parse($start)->diffInSeconds(Carbon::parse($row->created_at)));
        })->filter(static fn ($v): bool => is_int($v))->sort()->values()->all();

        if ($deltas === []) {
            return null;
        }
        $mid = intdiv(count($deltas), 2);

        return count($deltas) % 2 === 0 ? intdiv($deltas[$mid - 1] + $deltas[$mid], 2) : $deltas[$mid];
    }
}
