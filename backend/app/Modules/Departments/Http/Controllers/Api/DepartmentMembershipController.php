<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/v1/department/memberships
 *
 * Lists the caller's active department memberships so the operations
 * portal can render a department switcher for multi-membership staff
 * and pass the selection back as `?department_id=`.
 */
class DepartmentMembershipController extends Controller
{
    public function __construct(private readonly OperationDepartmentResolver $departments) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::unauthorized('Authentication required.');
        }

        $items = $this->departments
            ->activeMemberships($user)
            ->map(static fn (Department $d): array => [
                'id' => $d->id,
                'code' => $d->code,
                'name' => $d->name,
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => $items,
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
