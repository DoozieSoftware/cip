<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Admin;

use App\Modules\Reports\Http\Resources\AdminReportListResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Repositories\AdminReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\CursorPaginator;

/**
 * Read-only Super Admin report index across all departments.
 */
class AdminReportController extends BaseController
{
    public function __construct(private readonly AdminReportRepository $repository) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'department_id' => $request->query('department_id'),
            'status' => $request->query('status'),
            'category' => $request->query('category'),
            'officer_id' => $request->query('officer_id'),
            'assignment_type' => $request->query('assignment_type'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'q' => $request->query('q'),
        ];
        $filters = array_filter($filters, static fn ($value): bool => $value !== null && $value !== '');

        $page = $this->repository->search(
            $filters,
            (int) $request->query('per_page', 25),
            is_string($request->query('cursor')) ? $request->query('cursor') : null,
        );
        $items = ($page instanceof CursorPaginator ? collect($page->items()) : $page->getCollection())
            ->map(static fn (Report $report): array => (new AdminReportListResource($report))->toArray($request))
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

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
