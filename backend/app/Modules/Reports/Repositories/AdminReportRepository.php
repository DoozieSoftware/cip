<?php

declare(strict_types=1);

namespace App\Modules\Reports\Repositories;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Read-side repository for the Super Admin cross-department report view.
 *
 * Assignment filters use the additive Phase 1 fields on
 * `report_assignments`; they never change the report's primary department.
 */
class AdminReportRepository
{
    public const MAX_PER_PAGE = 100;

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Report>|CursorPaginator<int, Report>
     */
    public function search(array $filters, int $perPage = 25, ?string $cursor = null): LengthAwarePaginator|CursorPaginator
    {
        $query = Report::query()
            ->with([
                'reportType',
                'status',
                'priority',
                'department',
                'location',
                'activeAssignments.department',
                'activeAssignments.officer',
            ])
            ->withCount('media');

        $this->applyFilters($query, $filters);

        $perPage = max(1, min(self::MAX_PER_PAGE, $perPage));

        if ($cursor !== null) {
            return $query
                ->orderByDesc('submitted_at')
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->cursorPaginate($perPage, ['*'], 'cursor', $cursor);
        }

        return $query
            ->orderByDesc('submitted_at')
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Report>  $query
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        $departmentId = $this->stringFilter($filters, 'department_id', 'department');

        if ($departmentId !== null) {
            $query->where(function (Builder $departmentQuery) use ($departmentId): void {
                $departmentQuery->where('department_id', $departmentId)
                    ->orWhereHas('assignments', function (Builder $assignment) use ($departmentId): void {
                        $assignment
                            ->whereNull('reassigned_at')
                            ->whereNull('completed_at')
                            ->where('task_status', '!=', ReportAssignment::TASK_STATUS_CANCELLED)
                            ->where('department_id', $departmentId);
                    });
            });
        }

        $status = $this->stringFilter($filters, 'status');

        if ($status !== null) {
            $query->whereHas('status', fn (Builder $statusQuery): Builder => $statusQuery->where('code', $status));
        }

        $category = $this->stringFilter($filters, 'category');

        if ($category !== null) {
            $query->whereHas('reportType', fn (Builder $typeQuery): Builder => $typeQuery->where('code', $category));
        }

        $officerId = $this->stringFilter($filters, 'officer_id', 'officer');

        if ($officerId !== null) {
            $query->whereHas('assignments', function (Builder $assignment) use ($officerId): void {
                $assignment
                    ->whereNull('reassigned_at')
                    ->whereNull('completed_at')
                    ->where('task_status', '!=', ReportAssignment::TASK_STATUS_CANCELLED)
                    ->where('officer_id', $officerId);
            });
        }

        $assignmentType = $this->stringFilter($filters, 'assignment_type', 'assignment');

        if (in_array($assignmentType, [ReportAssignment::KIND_PRIMARY, ReportAssignment::KIND_SECONDARY], true)) {
            $isPrimary = $assignmentType === ReportAssignment::KIND_PRIMARY;
            $query->whereHas('assignments', function (Builder $assignment) use ($assignmentType, $isPrimary): void {
                $assignment
                    ->whereNull('reassigned_at')
                    ->whereNull('completed_at')
                    ->where('task_status', '!=', ReportAssignment::TASK_STATUS_CANCELLED)
                    ->where(function (Builder $typeQuery) use ($assignmentType, $isPrimary): void {
                        $typeQuery->where('kind', $assignmentType)->orWhere('is_primary', $isPrimary);
                    });
            });
        }

        $dateFrom = $this->stringFilter($filters, 'date_from');

        if ($dateFrom !== null) {
            $query->whereDate('submitted_at', '>=', $dateFrom);
        }

        $dateTo = $this->stringFilter($filters, 'date_to');

        if ($dateTo !== null) {
            $query->whereDate('submitted_at', '<=', $dateTo);
        }

        $search = $this->stringFilter($filters, 'q', 'search');

        if ($search !== null) {
            $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery->where('tracking_number', 'like', $search.'%');

                if (DB::getDriverName() === 'mysql') {
                    $searchQuery->orWhereFullText(['title', 'description'], $search);
                } else {
                    $term = '%'.$search.'%';
                    $searchQuery->orWhere('title', 'like', $term)
                        ->orWhere('description', 'like', $term);
                }
            });
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function stringFilter(array $filters, string ...$keys): ?string
    {
        foreach ($keys as $key) {
            if (is_string($filters[$key] ?? null) && $filters[$key] !== '') {
                return $filters[$key];
            }
        }

        return null;
    }
}
