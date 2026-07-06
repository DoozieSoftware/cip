<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentReportListController extends Controller
{
    public function __construct(private readonly DepartmentReportRepository $repo) {}

    public function index(Request $request): JsonResponse
    {
        $departmentId = $this->resolveDepartmentId($request);
        $page = $this->repo->assignedTo($departmentId, $request->query());

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

    private function resolveDepartmentId(Request $request): string
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw ApiException::unauthorized('Authentication required.');
        }
        if ($user->hasAnyRole(['super_admin', 'system']) && $request->filled('department_id')) {
            return (string) $request->string('department_id');
        }
        $dept = $user->departments()->first();
        if (! $dept) {
            throw ApiException::forbidden('User is not a member of any department.');
        }
        return (string) $dept->getKey();
    }
}
