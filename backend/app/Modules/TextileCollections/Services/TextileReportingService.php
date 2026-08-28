<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\TextileCollections\Models\TextileCapacityException;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TextileReportingService
{
    /**
     * @return array<string, mixed>
     */
    public function dashboard(string $departmentId, ?Carbon $start, ?Carbon $end, ?string $zoneId = null, ?string $category = null): array
    {
        $start ??= Carbon::now()->startOfYear();
        $end ??= Carbon::now()->endOfYear();

        $base = TextileCollectionRequest::query()
            ->where('textile_collection_requests.department_id', $departmentId)
            ->whereBetween('textile_collection_requests.created_at', [$start, $end]);

        if (is_string($zoneId) && $zoneId !== '') {
            $base->where('textile_collection_requests.service_zone_id', $zoneId);
        }

        if (is_string($category) && $category !== '' && in_array($category, TextileCollectionRequest::VALID_CATEGORIES, true)) {
            $base->where('textile_collection_requests.category', $category);
        }

        $totalRequests = (clone $base)->count();

        $statusBreakdown = (clone $base)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        $methodBreakdown = (clone $base)
            ->select('collection_method', DB::raw('count(*) as count'))
            ->groupBy('collection_method')
            ->pluck('count', 'collection_method')
            ->all();

        $zoneBreakdown = (clone $base)
            ->join('textile_service_zones', 'textile_collection_requests.service_zone_id', '=', 'textile_service_zones.id')
            ->select('textile_service_zones.name as zone_name', DB::raw('count(*) as count'))
            ->groupBy('textile_service_zones.name')
            ->pluck('count', 'zone_name')
            ->all();

        $categoryBreakdown = (clone $base)
            ->select('category', DB::raw('count(*) as count'))
            ->groupBy('category')
            ->pluck('count', 'category')
            ->all();

        $estimatedBags = (int) (clone $base)->sum('estimated_bags');
        $actualBags = (int) (clone $base)->sum('actual_bags');
        $estimatedKg = (float) (clone $base)->sum('estimated_weight_kg');
        $actualKg = (float) (clone $base)->sum('actual_weight_kg');

        $tripCount = TextileCollectionBatch::query()
            ->whereHas('requests', fn ($q) => $q->where('department_id', $departmentId))
            ->whereBetween('collection_date', [$start->toDateString(), $end->toDateString()])
            ->count();

        // Time-to-stage: booking to approval/schedule/collection (median via avg for simplicity; document as mean in response).
        $avgHoursToApproval = (clone $base)
            ->whereNotNull('dropoff_confirmed_at')
            ->orWhere(function ($q) use ($departmentId, $start, $end): void {
                $q->where('department_id', $departmentId)
                    ->whereBetween('created_at', [$start, $end])
                    ->where('status', '!=', TextileCollectionRequest::STATUS_PENDING_REVIEW)
                    ->whereNotNull('updated_at');
            })->avg(DB::raw('TIMESTAMPDIFF(HOUR, created_at, updated_at)'));

        // Reschedule rate.
        $rescheduledCount = (clone $base)->where('reschedule_count', '>', 0)->count();
        $rescheduleRate = $totalRequests > 0 ? round(($rescheduledCount / $totalRequests) * 100, 1) : 0.0;

        $missedValue = $statusBreakdown[TextileCollectionRequest::STATUS_MISSED] ?? 0;
        $missedCount = is_numeric($missedValue) ? (int) $missedValue : 0;
        $missedRate = $totalRequests > 0 ? round(($missedCount / $totalRequests) * 100, 1) : 0.0;

        $exceptionCount = TextileCapacityException::query()
            ->where('department_id', $departmentId)
            ->whereBetween('created_at', [$start, $end])
            ->when(is_string($zoneId) && $zoneId !== '', fn ($q) => $q->where('service_zone_id', $zoneId))
            ->count();

        $exceptionApproved = TextileCapacityException::query()
            ->where('department_id', $departmentId)
            ->where('status', TextileCapacityException::STATUS_APPROVED)
            ->whereBetween('created_at', [$start, $end])
            ->when(is_string($zoneId) && $zoneId !== '', fn ($q) => $q->where('service_zone_id', $zoneId))
            ->count();

        $exceptionRate = $totalRequests > 0 ? round(($exceptionCount / $totalRequests) * 100, 1) : 0.0;

        // Drop-off vs premises volume.
        $dropoffVolume = (clone $base)->where('collection_method', 'dropoff')->count();
        $premisesVolume = (clone $base)->where('collection_method', 'premises')->count();

        // Data-quality check: requests missing estimates.
        $missingEstimates = (clone $base)->whereNull('estimated_bags')->orWhere(function ($q) use ($departmentId, $start, $end): void {
            $q->where('department_id', $departmentId)->whereBetween('created_at', [$start, $end])->whereNull('estimated_weight_kg');
        })->count();

        return [
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'totals' => [
                'requests' => $totalRequests,
                'trips' => $tripCount,
                'estimated_bags' => $estimatedBags,
                'actual_bags' => $actualBags,
                'estimated_weight_kg' => round($estimatedKg, 2),
                'actual_weight_kg' => round($actualKg, 2),
                'variance_bags' => $estimatedBags > 0 ? round((($actualBags - $estimatedBags) / $estimatedBags) * 100, 1) : null,
                'variance_weight_kg' => $estimatedKg > 0 ? round((($actualKg - $estimatedKg) / $estimatedKg) * 100, 1) : null,
            ],
            'breakdowns' => [
                'status' => $statusBreakdown,
                'collection_method' => $methodBreakdown,
                'zone' => $zoneBreakdown,
                'category' => $categoryBreakdown,
            ],
            'volumes' => [
                'dropoff' => $dropoffVolume,
                'premises' => $premisesVolume,
            ],
            'rates' => [
                'missed_count' => $missedCount,
                'missed_rate_pct' => $missedRate,
                'rescheduled_count' => $rescheduledCount,
                'reschedule_rate_pct' => $rescheduleRate,
                'exception_count' => $exceptionCount,
                'exception_approved' => $exceptionApproved,
                'exception_rate_pct' => $exceptionRate,
            ],
            'timing' => [
                'avg_hours_booking_to_update' => $avgHoursToApproval !== null ? round((float) $avgHoursToApproval, 1) : null,
            ],
            'data_quality' => [
                'missing_estimates' => $missingEstimates,
                'has_baseline' => $totalRequests >= 50,
                'note' => $totalRequests < 50 ? 'Insufficient volume for KPI targets — collect a baseline before setting targets.' : 'Baseline established.',
            ],
            'definitions' => [
                'requests' => 'All textile_collection_requests for the partner in the period.',
                'trips' => 'Count of textile_collection_batches with at least one request for the partner.',
                'variance' => '(actual - estimated) / estimated * 100.',
                'missed_rate' => 'missed / total requests.',
                'reschedule_rate' => 'rescheduled at least once / total requests.',
                'exception_rate' => 'capacity exceptions requested / total requests.',
                'dropoff' => 'Requests with collection_method = dropoff.',
                'premises' => 'Requests with collection_method = premises.',
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function timeseries(string $departmentId, Carbon $start, Carbon $end, string $granularity = 'month'): array
    {
        $format = $granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';

        $rows = DB::table('textile_collection_requests')
            ->where('department_id', $departmentId)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("DATE_FORMAT(created_at, '{$format}') as period, count(*) as total, sum(actual_bags) as actual_bags, sum(estimated_bags) as estimated_bags")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        /** @var array<int, array<string, mixed>> $out */
        $out = $rows->map(function (object $row): array {
            $period = isset($row->period) && is_string($row->period) ? $row->period : '';
            $total = isset($row->total) && is_numeric($row->total) ? (int) $row->total : 0;
            $actualBags = isset($row->actual_bags) && is_numeric($row->actual_bags) ? (int) $row->actual_bags : 0;
            $estimatedBags = isset($row->estimated_bags) && is_numeric($row->estimated_bags) ? (int) $row->estimated_bags : 0;

            return [
                'period' => $period,
                'requests' => $total,
                'actual_bags' => $actualBags,
                'estimated_bags' => $estimatedBags,
            ];
        })->all();

        return $out;
    }
}
