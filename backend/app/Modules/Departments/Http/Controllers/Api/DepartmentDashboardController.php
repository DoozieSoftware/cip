<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Http\Resources\DashboardResource;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentDashboardController extends Controller
{
    public function __construct(private readonly DepartmentReportRepository $repo) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw ApiException::unauthorized('Authentication required.');
        }

        $deptId = $user->hasAnyRole(['super_admin', 'system']) && $request->filled('department_id')
            ? (string) $request->string('department_id')
            : (string) ($user->departments()->first()?->getKey() ?? '');
        if ($deptId === '') {
            throw ApiException::forbidden('User is not a member of any department.');
        }

        $counts = $this->repo->dashboardCounts($deptId) + ['department_id' => $deptId];

        return response()->json([
            'success' => true,
            'data' => (new DashboardResource($counts))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
