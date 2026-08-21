<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\Http\Resources\ReportListResource;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Http\Resources\ReportStatusHistoryResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\CursorPaginator;

class StaffReportController extends BaseController
{
    public function __construct(
        private readonly ReportRepository $repository,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureStaff($request);

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $filters = [
            'status' => $request->query('status'),
            'department' => $request->query('department'),
            'ward' => $request->query('ward'),
            'priority' => $request->query('priority'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'search' => $request->query('q'),
            'sort' => $request->query('sort'),
            'dir' => $request->query('dir'),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $scope = DepartmentScope::isDepartmentScopedStaff($user)
            ? DepartmentScope::memberDepartmentIds($user)
            : null;

        $page = $this->repository->searchByRole(
            $filters,
            perPage: (int) $request->query('per_page', 25),
            departmentScope: $scope,
            cursor: is_string($request->query('cursor')) ? $request->query('cursor') : null,
        );

        $items = ($page instanceof CursorPaginator ? collect($page->items()) : $page->getCollection())
            ->map(static fn (Report $r): array => (new ReportListResource($r))->toArray($request))
            ->values()
            ->all();

        if ($page instanceof CursorPaginator) {
            return $this->respond($items, 'OK', 200, [
                'per_page' => $page->perPage(),
                'next_cursor' => $page->nextCursor()?->encode(),
                'prev_cursor' => $page->previousCursor()?->encode(),
            ]);
        }

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->ensureStaff($request);
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Complaint');
        }

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $this->assertDepartmentScopeAllows($user, $report);

        return $this->respond(
            (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
        );
    }

    public function timeline(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Complaint');
        }

        $user = $request->user();
        $isOwner = $user !== null
            && ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user !== null && $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot view this timeline.');
        }

        if (! $isOwner && $user !== null) {
            $this->assertDepartmentScopeAllows($user, $report);
        }

        $rows = $this->repository->paginateTimeline($id);
        $payload = $rows->map(static fn ($row): array => (new ReportStatusHistoryResource($row))->toArray($request))->values()->all();

        return $this->respond($payload);
    }

    private function ensureStaff(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('Staff role is required.');
        }
    }

    private function assertDepartmentScopeAllows(User $user, Report $report): void
    {
        if (! DepartmentScope::canViewReport($user, $report)) {
            throw ApiException::forbidden('This report is outside your department scope.');
        }
    }
}
