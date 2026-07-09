<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Admin;

use App\Modules\Departments\Http\Requests\AttachOfficerRequest;
use App\Modules\Departments\Http\Requests\UpdateDepartmentAdminRequest;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentRepository;
use App\Modules\Departments\Services\DepartmentAdminService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;


/**
 * T-M11-009 — Department admin endpoints.
 *
 *  - GET    /api/v1/admin/departments/{department}/officers
 *  - POST   /api/v1/admin/departments/{department}/officers
 *  - DELETE /api/v1/admin/departments/{department}/officers/{user}
 *  - PATCH  /api/v1/admin/departments/{department}/admin
 *
 * The admin surface is gated to the `super_admin` role; the
 * form requests authorize locally and the service writes the
 * audit row. Per AGENTS.md the controller is intentionally
 * thin — it just translates HTTP into service calls.
 */
class DepartmentAdminController extends BaseController
{
    public function __construct(
        private readonly DepartmentRepository $repository,
        private readonly DepartmentAdminService $service,
    ) {}

    /**
     * GET /api/v1/admin/departments/{department}/officers
     */
    public function listOfficers(Request $request, string $department): JsonResponse
    {
        $dept = $this->resolveDepartment($department);
        $this->ensureCanManage($request, $dept);

        $paginator = $dept->users()
            ->orderBy('pivot_is_manager', 'desc')
            ->orderBy('name')
            ->paginate(perPage: (int) $request->query('per_page', 50));

        $rows = collect($paginator->items())->map(static function (User $u): array {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'mobile' => $u->mobile,
                'email' => $u->email,
                'is_manager' => (bool) ($u->pivot->is_manager ?? false),
                'assigned_at' => $u->pivot->assigned_at ?? null,
            ];
        })->all();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'trace_id' => $this->traceId($request),
            ],
        ]);
    }

    /**
     * POST /api/v1/admin/departments/{department}/officers
     */
    public function attachOfficer(AttachOfficerRequest $request, string $department): JsonResponse
    {
        $dept = $this->resolveDepartment($department);
        $this->ensureCanManage($request, $dept);

        $pivotId = $this->service->attachOfficer(
            $dept,
            $request->user(),
            $request->string('user_id')->toString(),
            (bool) $request->boolean('is_manager'),
            $request->date('assigned_at'),
            $request,
        );

        return $this->respond(
            ['pivot_id' => $pivotId, 'department_id' => $dept->id],
            'Officer attached.',
            201,
            ['trace_id' => $this->traceId($request)],
        );
    }

    /**
     * DELETE /api/v1/admin/departments/{department}/officers/{user}
     */
    public function detachOfficer(Request $request, string $department, string $user): JsonResponse
    {
        $dept = $this->resolveDepartment($department);
        $this->ensureCanManage($request, $dept);

        $removed = $this->service->detachOfficer($dept, $request->user(), $user, $request);

        return $this->respond(
            ['removed' => $removed],
            $removed ? 'Officer detached.' : 'Officer was not attached.',
            200,
            ['trace_id' => $this->traceId($request)],
        );
    }

    /**
     * PATCH /api/v1/admin/departments/{department}/admin
     *
     * Updates the per-department admin surface
     * (SLA minutes, working hours, holiday calendar,
     * escalation matrix) in one transaction.
     */
    public function updateAdmin(UpdateDepartmentAdminRequest $request, string $department): JsonResponse
    {
        $dept = $this->resolveDepartment($department);
        $this->ensureCanManage($request, $dept);

        $updated = $this->service->updateAdmin($dept, $request->user(), $request->validated(), $request);

        return $this->respond(
            [
                'id' => $updated->id,
                'default_sla_minutes' => $updated->default_sla_minutes,
                'working_hours' => $updated->working_hours,
                'holiday_calendar' => $updated->holiday_calendar,
                'escalation_matrix' => $updated->escalation_matrix,
            ],
            'Department admin settings updated.',
            200,
            ['trace_id' => $this->traceId($request)],
        );
    }

    private function resolveDepartment(string $id): Department
    {
        $dept = $this->repository->findById($id);
        if ($dept === null) {
            throw ApiException::notFound('Department');
        }

        return $dept;
    }

    /**
     * Authorize department-management access.
     *
     *  - super_admin / system may manage any department.
     *  - department_admin may manage ONLY a department they
     *    belong to (membership via the department_users pivot).
     *  - everyone else (including regular department_officers)
     *    is forbidden.
     */
    private function ensureCanManage(Request $request, Department $dept): void
    {
        $u = $request->user('sanctum');
        if (! $u instanceof User) {
            throw new ApiException('FORBIDDEN', 'Authentication required.', 403);
        }

        if ($u->hasAnyRole(['super_admin', 'system'])) {
            return;
        }

        if ($u->hasRole('department_admin')
            && $u->departments()->whereKey($dept->getKey())->exists()) {
            return;
        }

        throw new ApiException(
            'FORBIDDEN',
            'You are not allowed to manage this department.',
            403,
        );
    }
}
