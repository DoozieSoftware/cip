<?php

declare(strict_types=1);

namespace App\Modules\Departments\Repositories;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * M11 — Repository for the operations-portal report views.
 *
 * Per `docs/08` §9 and `docs/14` §9. The repository scopes
 * every query to the given department (caller responsibility
 * — the controller gets the department from the route binding
 * or from the authenticated user's primary department) and
 * composes the standard filter set:
 *
 *   - status (free-text code, exact match on `report_statuses.code`)
 *   - priority (code)
 *   - category (code)
 *   - ward (id)
 *   - date_from / date_to (on `submitted_at`)
 *   - search (tracking_number LIKE, title LIKE)
 *
 * Pagination is capped at MAX_PER_PAGE so a single list page can
 * never fan out into an unbounded response.
 */
class DepartmentReportRepository
{
    public const MAX_PER_PAGE = 100;

    /**
     * Statuses that are actually in the department's hands and
     * therefore visible in the operations portal. Reports sitting
     * in the moderation/AI pipeline (`submitted`, `ai_processing`,
     * `pending_moderator`) or rejected before dispatch are
     * excluded — even if a `department_id` has been set on them
     * (e.g. by a bulk reroute), they are not the officer's to act
     * on yet. Terminal department states (closed/merged) stay
     * visible as history.
     */
    private const IN_HAND_STATUSES = [
        'assigned',
        'accepted',
        'in_progress',
        'resolved',
        'verified',
        'closed',
        'escalated',
        'merged',
    ];

    /**
     * @param  array<array-key, mixed>  $filters
     * @return LengthAwarePaginator<int, Report>|CursorPaginator<int, Report>
     */
    public function assignedTo(string $departmentId, array $filters = []): LengthAwarePaginator|CursorPaginator
    {
        $query = Report::query()
            ->where(function (Builder $query) use ($departmentId): void {
                $query->where('department_id', $departmentId)
                    ->orWhereHas('assignments', function (Builder $assignment) use ($departmentId): void {
                        $assignment
                            ->whereNull('completed_at')
                            ->where('task_status', ReportAssignment::TASK_STATUS_OPEN)
                            ->where('department_id', $departmentId);
                    });
            })
            ->with([
                'reportType',
                'department',
                'status',
                'priority',
                'location',
                'activeAssignments.officer',
            ])
            ->withCount('media');

        $this->applyInHandScope($query);
        $this->applyAssignmentKindScope($query, $departmentId, $filters);
        $this->applyFilters($query, $filters);

        $rawPerPage = $filters['per_page'] ?? 20;
        $perPage = is_numeric($rawPerPage) ? (int) $rawPerPage : 20;
        $perPage = max(1, min(self::MAX_PER_PAGE, $perPage));

        $cursor = is_string($filters['cursor'] ?? null) && $filters['cursor'] !== ''
            ? $filters['cursor']
            : null;

        if ($cursor !== null) {
            return $query
                ->orderByDesc('submitted_at')
                ->orderByDesc('id')
                ->cursorPaginate($perPage, ['*'], 'cursor', $cursor);
        }

        return $query->orderByDesc('submitted_at')->paginate($perPage);
    }

    public function detail(Report $report): Report
    {
        return $report->load([
            'reportType',
            'department',
            'status',
            'priority',
            'location',
            'internalNotes.author',
            'media',
            'statusHistory.fromStatus',
            'statusHistory.toStatus',
            'assignments.department',
            'assignments.officer',
        ]);
    }

    /**
     * @return array<string, array<int<0, max>>|int<0, max>>
     */
    public function dashboardCounts(string $departmentId): array
    {
        $base = Report::query()->where(function (Builder $query) use ($departmentId): void {
            $query->where('department_id', $departmentId)
                ->orWhereHas('assignments', function (Builder $assignment) use ($departmentId): void {
                    $assignment
                        ->whereNull('completed_at')
                        ->where('task_status', ReportAssignment::TASK_STATUS_OPEN)
                        ->where('department_id', $departmentId);
                });
        });
        $base->whereHas('status', fn ($q) => $q->whereIn('code', self::IN_HAND_STATUSES));

        $open = (clone $base)->whereHas('status', fn ($q) => $q->where('is_terminal', false))->count();
        $dueToday = (clone $base)
            ->whereHas('status', fn ($q) => $q->where('is_terminal', false))
            ->whereDate('submitted_at', today())
            ->count();
        $breached = (clone $base)
            ->whereHas('status', fn ($q) => $q->where('is_terminal', false))
            ->where('submitted_at', '<', now()->subDay())
            ->count();

        $byCategory = (clone $base)
            ->with('reportType')
            ->get()
            ->groupBy(fn (Report $r) => $r->reportType->code ?? 'uncategorized')
            ->map->count()
            ->all();

        return [
            'open' => $open,
            'due_today' => $dueToday,
            'sla_breached' => $breached,
            'by_category' => $byCategory,
        ];
    }

    /**
     * @param  array<array-key, mixed>  $filters
     * @param  Builder<Report>  $query
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->whereHas('status', fn ($q) => $q->where('code', $filters['status']));
        }

        if (! empty($filters['priority'])) {
            $query->whereHas('priority', fn ($q) => $q->where('code', $filters['priority']));
        }

        if (! empty($filters['category'])) {
            $query->whereHas('reportType', fn ($q) => $q->where('code', $filters['category']));
        }

        if (! empty($filters['ward_id'])) {
            $query->whereHas('location', fn ($q) => $q->where('ward_id', $filters['ward_id']));
        }

        if (! empty($filters['date_from'])) {
            $query->where('submitted_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->where('submitted_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['search']) && is_string($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function (Builder $q) use ($search): void {
                $q->where('tracking_number', 'like', $search.'%');

                if (DB::getDriverName() === 'mysql') {
                    $q->orWhereFullText(['title', 'description'], $search);
                } else {
                    $term = '%'.$search.'%';
                    $q->orWhere('title', 'like', $term)
                        ->orWhere('description', 'like', $term);
                }
            });
        }
    }

    /**
     * Secondary work is filtered at the database boundary so pagination does
     * not hide tasks behind unrelated primary reports.
     *
     * @param  array<array-key, mixed>  $filters
     * @param  Builder<Report>  $query
     */
    private function applyAssignmentKindScope(Builder $query, string $departmentId, array $filters): void
    {
        if (($filters['assignment_kind'] ?? null) !== ReportAssignment::KIND_SECONDARY) {
            return;
        }

        $query->whereHas('assignments', function (Builder $assignment) use ($departmentId): void {
            $assignment
                ->whereNull('completed_at')
                ->where('task_status', ReportAssignment::TASK_STATUS_OPEN)
                ->where('department_id', $departmentId)
                ->where('kind', ReportAssignment::KIND_SECONDARY);
        });
    }

    /**
     * Restrict the query to statuses the department actually owns
     * (see IN_HAND_STATUSES) so the officer queue is not polluted
     * by reports that are still in moderation or were rejected.
     *
     * @param  Builder<Report>  $query
     */
    private function applyInHandScope(Builder $query): void
    {
        $query->whereHas('status', fn ($q) => $q->whereIn('code', self::IN_HAND_STATUSES));
    }
}
