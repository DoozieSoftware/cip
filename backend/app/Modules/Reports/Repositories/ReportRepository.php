<?php

declare(strict_types=1);

namespace App\Modules\Reports\Repositories;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Read/write access to the `reports` table and the
 * `report_status_history` timeline.
 *
 * Pure data access — no business rules, no events, no audit
 * emission. The ReportService owns those concerns.
 */
class ReportRepository
{
    /**
     * @return Builder<Report>
     */
    public function query(): Builder
    {
        return Report::query();
    }

    public function findById(string $id): ?Report
    {
        return Report::query()->find($id);
    }

    public function findByTrackingNumber(string $trackingNumber): ?Report
    {
        return Report::query()->where('tracking_number', $trackingNumber)->first();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Report
    {
        return Report::query()->create($attributes);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Report $report, array $attributes): Report
    {
        $report->update($attributes);

        return $report;
    }

    /**
     * Staff-side search: every filter is optional; the result
     * is paginated. The caller is expected to be a moderator /
     * department officer / super_admin.
     *
     * @param  array{
     *     status?: string|null,
     *     department?: string|null,
     *     ward?: string|null,
     *     priority?: string|null,
     *     date_from?: string|null,
     *     date_to?: string|null,
     *     search?: string|null,
     *     sort?: string|null,
     *     dir?: string|null,
     * }  $filters
     * @return LengthAwarePaginator<int, Report>
     */
    public function searchByRole(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $q = $this->baseSearch($filters);

        $sort = in_array($filters['sort'] ?? null, ['created_at', 'submitted_at', 'priority_id', 'current_status_id'], true)
            ? $filters['sort']
            : 'created_at';
        $dir = strtolower((string) ($filters['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    /**
     * Citizen-side search: only the authenticated citizen's own
     * reports are returned. `is_anonymous` rows are excluded.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Report>
     */
    public function searchForCitizen(User $citizen, array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $q = $this->baseSearch($filters)->where('citizen_id', $citizen->id);

        return $q->orderByDesc('created_at')->paginate($perPage);
    }

    /**
     * Timeline for a single report, oldest-first.
     *
     * @return Collection<int, ReportStatusHistory>
     */
    public function paginateTimeline(string $reportId): Collection
    {
        return ReportStatusHistory::query()
            ->where('report_id', $reportId)
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Dashboard counts for a citizen: total reports, open (not
     * closed/rejected), resolved, plus the distinct notifiable
     * statuses. Anonymous reports are excluded.
     *
     * @return array<string, int>
     */
    public function citizenDashboardCounts(string $citizenId): array
    {
        $q = Report::query()->where('citizen_id', $citizenId);
        $total = (int) (clone $q)->count();

        $openStatusIds = ReportStatus::query()
            ->whereIn('code', ['submitted', 'ai_processing', 'ai_completed', 'under_review', 'assigned', 'in_progress'])
            ->pluck('id')
            ->all();

        $resolvedStatusIds = ReportStatus::query()
            ->whereIn('code', ['resolved', 'closed'])
            ->pluck('id')
            ->all();

        $open = $openStatusIds === [] ? 0 : (int) (clone $q)->whereIn('current_status_id', $openStatusIds)->count();
        $resolved = $resolvedStatusIds === [] ? 0 : (int) (clone $q)->whereIn('current_status_id', $resolvedStatusIds)->count();
        $rejected = (int) (clone $q)->whereHas('status', static function ($qq): void {
            $qq->where('code', 'rejected');
        })->count();

        return [
            'total' => $total,
            'open' => $open,
            'resolved' => $resolved,
            'rejected' => $rejected,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Report>
     */
    private function baseSearch(array $filters): Builder
    {
        $q = Report::query();

        if (! empty($filters['status']) && is_string($filters['status'])) {
            $statusId = ReportStatus::query()->where('code', $filters['status'])->value('id');

            if (is_string($statusId) && $statusId !== '') {
                $q->where('current_status_id', $statusId);
            }
        }

        if (! empty($filters['department']) && is_string($filters['department'])) {
            $q->where('department_id', $filters['department']);
        }

        if (! empty($filters['ward']) && is_string($filters['ward'])) {
            $q->whereHas('location', function (Builder $w) use ($filters): void {
                $w->where('ward_id', $filters['ward']);
            });
        }

        if (! empty($filters['priority']) && is_string($filters['priority'])) {
            $q->where('priority_id', $filters['priority']);
        }

        if (! empty($filters['date_from']) && is_string($filters['date_from'])) {
            $q->where('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to']) && is_string($filters['date_to'])) {
            $q->where('created_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['search']) && is_string($filters['search'])) {
            $needle = '%'.$filters['search'].'%';
            $q->where(function (Builder $w) use ($needle): void {
                $w->where('tracking_number', 'like', $needle)
                    ->orWhere('title', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            });
        }

        return $q;
    }
}
