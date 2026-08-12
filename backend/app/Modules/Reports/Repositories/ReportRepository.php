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
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\LengthAwarePaginator as ConcreteLengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ReportRepository
{
    public const MAX_PER_PAGE = 100;

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

    public function findByIdWithRelations(string $id): ?Report
    {
        return Report::query()
            ->with([
                'status',
                'reportType',
                'priority',
                'location',
                'location.ward',
                'location.district',
                'department',
                'media',
                'statusHistory.fromStatus',
                'statusHistory.toStatus',
            ])
            ->find($id);
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
     * Staff search. `$departmentScope` enforces Phase 1 data isolation:
     *  - null                → unrestricted staff (sees everything)
     *  - list<string> (any)  → department-scoped staff; only reports owned
     *                          by, or with an open assignment in, one of
     *                          the given departments
     *  - [] empty list       → scoped user with no memberships → no rows
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
     * @param  list<string>|null  $departmentScope
     * @return ConcreteLengthAwarePaginator<int, Report>|CursorPaginator<int, Report>
     */
    public function searchByRole(array $filters, int $perPage = 25, ?array $departmentScope = null, ?string $cursor = null): LengthAwarePaginator|CursorPaginator
    {
        $q = $this->baseSearch($filters)
            ->with(['reportType', 'status', 'priority', 'location', 'department'])
            ->withCount('media');

        if ($departmentScope !== null) {
            $q->where(function (Builder $w) use ($departmentScope): void {
                $w->whereIn('department_id', $departmentScope)
                    ->orWhereHas('assignments', function (Builder $a) use ($departmentScope): void {
                        $a->whereNull('completed_at')->whereIn('department_id', $departmentScope);
                    });
            });
        }

        $sort = in_array($filters['sort'] ?? null, ['created_at', 'submitted_at', 'priority_id', 'current_status_id'], true)
            ? $filters['sort']
            : 'created_at';
        $dir = strtolower((string) ($filters['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min(self::MAX_PER_PAGE, $perPage));

        if ($cursor !== null) {
            // Cursor mode is opt-in for existing clients and always has a
            // unique tie-breaker so rows are neither skipped nor repeated.
            return $q
                ->orderBy($sort, $dir)
                ->orderBy('id', $dir)
                ->cursorPaginate($perPage, ['*'], 'cursor', $cursor);
        }

        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    /**
     * Citizen-side search: only the authenticated citizen's own
     * reports are returned. `is_anonymous` rows are excluded.
     *
     * @param  array<string, mixed>  $filters
     * @return ConcreteLengthAwarePaginator<int, Report>|CursorPaginator<int, Report>
     */
    public function searchForCitizen(User $citizen, array $filters, int $perPage = 25, ?string $cursor = null): LengthAwarePaginator|CursorPaginator
    {
        $q = $this->baseSearch($filters)
            ->where('citizen_id', $citizen->id)
            ->with(['reportType', 'status', 'priority', 'location', 'department'])
            ->withCount('media');

        $perPage = max(1, min(self::MAX_PER_PAGE, $perPage));

        if ($cursor !== null) {
            return $q
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->cursorPaginate($perPage, ['*'], 'cursor', $cursor);
        }

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
            ->with(['fromStatus', 'toStatus', 'actor'])
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

        $resolvedStatusIds = ReportStatus::query()
            ->whereIn('code', ['resolved', 'closed'])
            ->pluck('id')
            ->all();

        $open = (int) (clone $q)
            ->whereHas('status', static function ($qq): void {
                $qq->where('is_terminal', false)->where('code', '!=', 'rejected');
            })
            ->count();
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
            $status = $filters['status'];
            $groups = [
                'open' => ['submitted', 'ai_processing', 'pending_moderator', 'assigned', 'accepted', 'in_progress', 'escalated'],
                'awaiting_citizen' => ['resolved_pending_verification'],
                'closed' => ['verified', 'closed'],
                'rejected' => ['rejected'],
                'merged' => ['merged'],
            ];
            $codes = $groups[$status] ?? [$status];
            $statusIds = ReportStatus::query()->whereIn('code', $codes)->pluck('id')->all();

            if ($statusIds !== []) {
                $q->whereIn('current_status_id', $statusIds);
            }
        }

        if (! empty($filters['department']) && is_string($filters['department'])) {
            $q->where('department_id', $filters['department']);
        }

        $reportTypeId = $filters['report_type_id'] ?? $filters['category'] ?? null;

        if (is_string($reportTypeId) && $reportTypeId !== '') {
            $q->where('report_type_id', $reportTypeId);
        }

        $ward = $filters['ward'] ?? $filters['area'] ?? null;

        if (is_string($ward) && $ward !== '') {
            $q->whereHas('location', function (Builder $w) use ($ward): void {
                $w->where('ward_id', $ward)
                    ->orWhere('address', 'like', '%'.$ward.'%');
            });
        }

        if (! empty($filters['priority']) && is_string($filters['priority'])) {
            $q->where('priority_id', $filters['priority']);
        }

        if (! empty($filters['date_from']) && is_string($filters['date_from'])) {
            $q->where('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to']) && is_string($filters['date_to'])) {
            $q->whereDate('created_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['search']) && is_string($filters['search'])) {
            $search = trim($filters['search']);
            $q->where(function (Builder $w) use ($search): void {
                // Tracking references are exact/prefix lookups, preserving
                // the unique index instead of forcing a leading wildcard.
                $w->where('tracking_number', 'like', $search.'%');

                if (DB::getDriverName() === 'mysql') {
                    $w->orWhereFullText(['title', 'description'], $search);
                } else {
                    $needle = '%'.$search.'%';
                    $w->orWhere('title', 'like', $needle)
                        ->orWhere('description', 'like', $needle);
                }
            });
        }

        return $q;
    }
}
