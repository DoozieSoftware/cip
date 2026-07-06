<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Services;

use App\Modules\AI\Models\AiJob;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ModerationAnalyticsService
{
    /**
     * @return array<string, float|int>
     */
    public function summary(): array
    {
        $queueStatusIds = $this->statusIdsFor(['ai_processing', 'pending_moderator', 'escalated']);
        $todayActions = $this->moderationActionRows(now()->startOfDay());
        $aiPerformance = $this->aiPerformance('7d');

        return [
            'pending_moderator' => Report::query()
                ->whereNull('deleted_at')
                ->whereIn('current_status_id', $queueStatusIds)
                ->count(),
            'duplicates_pending' => Report::query()
                ->whereNull('deleted_at')
                ->whereNotNull('duplicate_score')
                ->where('duplicate_score', '>=', 60.0)
                ->count(),
            'fraud_pending' => Report::query()
                ->whereNull('deleted_at')
                ->whereNotNull('fraud_score')
                ->where('fraud_score', '>=', 60.0)
                ->count(),
            'approved_today' => $todayActions->where('to_code', 'assigned')->count(),
            'rejected_today' => $todayActions->where('to_code', 'rejected')->count(),
            'merged_today' => $todayActions->where('to_code', 'merged')->count(),
            'escalated_today' => $todayActions->where('to_code', 'escalated')->count(),
            'avg_review_minutes' => $this->averageReviewMinutes($todayActions),
            'ai_accuracy_pct' => 100.0 - (float) $aiPerformance['override_rate_pct'],
        ];
    }

    /**
     * @return array{
     *   window: '24h'|'7d'|'30d',
     *   total_ai_decisions: int,
     *   overridden_by_moderator: int,
     *   override_rate_pct: float,
     *   per_provider: array<int, array{provider_code: string, total: int, overridden: int, avg_confidence: float}>
     * }
     */
    public function aiPerformance(string $window = '7d'): array
    {
        $normalizedWindow = in_array($window, ['24h', '7d', '30d'], true) ? $window : '7d';
        $since = match ($normalizedWindow) {
            '24h' => now()->subDay(),
            '30d' => now()->subDays(30),
            default => now()->subDays(7),
        };

        $actions = $this->moderationActionRows($since);
        $reportIds = $actions->pluck('report_id')->unique()->values()->all();

        if ($reportIds === []) {
            return [
                'window' => $normalizedWindow,
                'total_ai_decisions' => 0,
                'overridden_by_moderator' => 0,
                'override_rate_pct' => 0.0,
                'per_provider' => [],
            ];
        }

        $reports = Report::query()
            ->whereIn('id', $reportIds)
            ->get(['id', 'ai_confidence'])
            ->keyBy('id');

        /** @var Collection<string, AiJob> $jobsByReport */
        $jobsByReport = AiJob::query()
            ->whereIn('report_id', $reportIds)
            ->where('status', AiJob::STATUS_SUCCEEDED)
            ->orderByDesc('completed_at')
            ->orderByDesc('created_at')
            ->get()
            ->unique('report_id')
            ->keyBy('report_id');

        $totals = 0;
        $overridden = 0;
        /** @var array<string, array{provider_code: string, total: int, overridden: int, confidence_sum: float}> $perProvider */
        $perProvider = [];

        foreach ($actions as $action) {
            $job = $jobsByReport->get((string) $action->report_id);
            if (! $job instanceof AiJob) {
                continue;
            }

            $providerCode = (string) $job->provider_code;
            $isOverridden = $action->to_code !== 'assigned';
            $confidence = (float) ($reports->get((string) $action->report_id)?->ai_confidence ?? 0.0);

            $totals++;
            if ($isOverridden) {
                $overridden++;
            }

            if (! isset($perProvider[$providerCode])) {
                $perProvider[$providerCode] = [
                    'provider_code' => $providerCode,
                    'total' => 0,
                    'overridden' => 0,
                    'confidence_sum' => 0.0,
                ];
            }

            $perProvider[$providerCode]['total']++;
            $perProvider[$providerCode]['confidence_sum'] += $confidence;
            if ($isOverridden) {
                $perProvider[$providerCode]['overridden']++;
            }
        }

        $perProviderRows = array_values(array_map(
            static fn (array $row): array => [
                'provider_code' => $row['provider_code'],
                'total' => $row['total'],
                'overridden' => $row['overridden'],
                'avg_confidence' => $row['total'] > 0 ? round($row['confidence_sum'] / $row['total'], 4) : 0.0,
            ],
            $perProvider,
        ));

        return [
            'window' => $normalizedWindow,
            'total_ai_decisions' => $totals,
            'overridden_by_moderator' => $overridden,
            'override_rate_pct' => $totals > 0 ? round(($overridden / $totals) * 100, 1) : 0.0,
            'per_provider' => $perProviderRows,
        ];
    }

    /**
     * @return Collection<int, object{report_id: string, to_code: string, created_at: Carbon}>
     */
    private function moderationActionRows(Carbon $since): Collection
    {
        return ReportStatusHistory::query()
            ->select([
                'report_status_history.report_id',
                'report_status_history.created_at',
                'report_statuses.code as to_code',
            ])
            ->join('report_statuses', 'report_statuses.id', '=', 'report_status_history.to_status_id')
            ->whereIn('report_statuses.code', ['assigned', 'rejected', 'merged', 'escalated'])
            ->where('report_status_history.created_at', '>=', $since)
            ->orderBy('report_status_history.created_at')
            ->get();
    }

    private function averageReviewMinutes(Collection $actions): float
    {
        $reportIds = $actions->pluck('report_id')->unique()->values()->all();
        if ($reportIds === []) {
            return 0.0;
        }

        /** @var Collection<string, Collection<int, object{created_at: Carbon, to_code: string}>> $historyByReport */
        $historyByReport = ReportStatusHistory::query()
            ->select([
                'report_status_history.report_id',
                'report_status_history.created_at',
                'report_statuses.code as to_code',
            ])
            ->join('report_statuses', 'report_statuses.id', '=', 'report_status_history.to_status_id')
            ->whereIn('report_status_history.report_id', $reportIds)
            ->whereIn('report_statuses.code', ['ai_processing', 'pending_moderator', 'escalated', 'assigned', 'rejected', 'merged'])
            ->orderBy('report_status_history.created_at')
            ->get()
            ->groupBy('report_id');

        $durations = [];

        foreach ($actions as $action) {
            $history = $historyByReport->get((string) $action->report_id, collect());
            $start = $history
                ->filter(static fn (object $row): bool => in_array($row->to_code, ['ai_processing', 'pending_moderator', 'escalated'], true))
                ->filter(static fn (object $row): bool => $row->created_at->lt($action->created_at))
                ->last();

            if ($start !== null) {
                $durations[] = max(0, $start->created_at->diffInMinutes($action->created_at));
            }
        }

        if ($durations === []) {
            return 0.0;
        }

        return round(array_sum($durations) / count($durations), 1);
    }

    /**
     * @param  list<string>  $codes
     * @return list<string>
     */
    private function statusIdsFor(array $codes): array
    {
        /** @var list<string> $ids */
        $ids = ReportStatus::query()->whereIn('code', $codes)->pluck('id')->all();

        return $ids;
    }
}
