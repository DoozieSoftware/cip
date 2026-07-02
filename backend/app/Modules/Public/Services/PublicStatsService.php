<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Aggregate, privacy-safe platform statistics for the public landing
 * page (and, from M17, the Public Transparency Portal). Per Vision
 * §7 / PRD M7 and the Privacy-By-Design principle: only counts and
 * percentages leave this service — no citizen identity, no exact
 * coordinates, no evidence.
 *
 * Replaces the hardcoded `{ '12,847', '94%', '38s' }` array that
 * used to live directly in `LandingPage.tsx` — a stakeholder-facing
 * "live metrics" claim that was, in fact, three fixed strings.
 */
class PublicStatsService
{
    private const CACHE_KEY = 'public.stats';

    private const CACHE_TTL_SECONDS = 300;

    private const MEDIAN_SAMPLE_SIZE = 500;

    /**
     * @return array{total_reports: int, ai_classified_percent: float, median_assign_seconds: int|null}
     */
    public function summary(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            $total = Report::query()->count();
            $aiClassified = Report::query()->whereNotNull('ai_label')->count();

            return [
                'total_reports' => $total,
                'ai_classified_percent' => $total > 0 ? round(($aiClassified / $total) * 100, 1) : 0.0,
                'median_assign_seconds' => $this->medianAssignSeconds(),
            ];
        });
    }

    /**
     * Median seconds between a report entering `submitted` and
     * entering `assigned`, sampled over the most recent
     * MEDIAN_SAMPLE_SIZE assignments. Computed in PHP because MySQL
     * 8 has no built-in median/percentile aggregate; the sample is
     * bounded so this stays cheap even as report_status_history grows
     * (the result is cached for 5 minutes regardless).
     */
    private function medianAssignSeconds(): ?int
    {
        $submittedStatusId = ReportStatus::query()->where('code', 'submitted')->value('id');
        $assignedStatusId = ReportStatus::query()->where('code', 'assigned')->value('id');

        if (! is_string($submittedStatusId) || ! is_string($assignedStatusId)) {
            return null;
        }

        $recentAssignments = ReportStatusHistory::query()
            ->where('to_status_id', $assignedStatusId)
            ->orderByDesc('created_at')
            ->limit(self::MEDIAN_SAMPLE_SIZE)
            ->get(['report_id', 'created_at']);

        if ($recentAssignments->isEmpty()) {
            return null;
        }

        $submittedAtByReport = [];

        foreach (
            ReportStatusHistory::query()
                ->where('to_status_id', $submittedStatusId)
                ->whereIn('report_id', $recentAssignments->pluck('report_id'))
                ->get(['report_id', 'created_at']) as $submittedRow
        ) {
            $submittedAtByReport[$submittedRow->report_id] = Carbon::parse($submittedRow->created_at);
        }

        $deltas = [];

        foreach ($recentAssignments as $row) {
            $submittedAt = $submittedAtByReport[$row->report_id] ?? null;

            if ($submittedAt instanceof Carbon) {
                $deltas[] = (int) round(abs(Carbon::parse($row->created_at)->diffInSeconds($submittedAt)));
            }
        }

        if ($deltas === []) {
            return null;
        }

        sort($deltas);
        $count = count($deltas);
        $mid = intdiv($count, 2);

        return $count % 2 === 0
            ? intdiv($deltas[$mid - 1] + $deltas[$mid], 2)
            : $deltas[$mid];
    }
}
