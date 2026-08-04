<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentReportListController extends Controller
{
    public function __construct(
        private readonly DepartmentReportRepository $repo,
        private readonly OperationDepartmentResolver $departments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $departmentId = $this->resolveDepartmentId($request);
        $query = $request->query();
        $page = $this->repo->assignedTo($departmentId, is_array($query) ? $query : []);

        return response()->json([
            'success' => true,
            'data' => DepartmentReportResource::collection($page->items())->resolve($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }

    public function show(Report $report, Request $request): JsonResponse
    {
        $report = $this->repo->detail($report);

        return response()->json([
            'success' => true,
            'data' => (new DepartmentReportResource($report))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }

    private function resolveDepartmentId(Request $request): string
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::unauthorized('Authentication required.');
        }

        $requested = $request->query('department_id');

        return $this->departments
            ->resolve($user, is_string($requested) && $requested !== '' ? $requested : null)
            ->id;
    }
}
