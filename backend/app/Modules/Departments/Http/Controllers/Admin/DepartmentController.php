<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Admin;

use App\Modules\Departments\Http\Requests\StoreDepartmentRequest;
use App\Modules\Departments\Http\Requests\UpdateDepartmentRequest;
use App\Modules\Departments\Http\Resources\DepartmentResource;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentRepository;
use App\Modules\Departments\Services\DepartmentService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super Admin CRUD for departments per docs/05 §10 and docs/09 §7.
 *
 *  - GET    /api/v1/admin/departments
 *  - POST   /api/v1/admin/departments
 *  - GET    /api/v1/admin/departments/{department}
 *  - PUT    /api/v1/admin/departments/{department}
 *  - DELETE /api/v1/admin/departments/{department}
 *
 * Per AGENTS.md — no business logic here. All writes go through
 * DepartmentService (which emits the audit events). The
 * `super_admin` role gate is on each Form Request's authorize().
 */
class DepartmentController extends BaseController
{
    public function __construct(
        private readonly DepartmentRepository $repository,
        private readonly DepartmentService $service,
    ) {}

    /**
     * GET /api/v1/admin/departments
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'jurisdiction' => $request->query('jurisdiction'),
            'parent_id' => $request->query('parent_id'),
            'active' => $request->query('active') === null ? null : filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, perPage: (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (Department $d): array => (new DepartmentResource($d))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    /**
     * POST /api/v1/admin/departments
     */
    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $dept = $this->service->create($request->validated());

        return $this->respond((new DepartmentResource($dept))->toArray($request), 'Department created.', 201);
    }

    /**
     * GET /api/v1/admin/departments/{department}
     */
    public function show(Request $request, string $department): JsonResponse
    {
        $this->ensureAdmin($request);
        $dept = $this->repository->findById($department);

        if ($dept === null) {
            throw ApiException::notFound('Department');
        }

        return $this->respond((new DepartmentResource($dept->load('parent', 'children')))->toArray($request));
    }

    /**
     * PUT /api/v1/admin/departments/{department}
     */
    public function update(UpdateDepartmentRequest $request, string $department): JsonResponse
    {
        $dept = $this->repository->findById($department);

        if ($dept === null) {
            throw ApiException::notFound('Department');
        }

        $dept = $this->service->update($dept, $request->validated());

        return $this->respond((new DepartmentResource($dept))->toArray($request), 'Department updated.');
    }

    /**
     * DELETE /api/v1/admin/departments/{department}
     */
    public function destroy(Request $request, string $department): JsonResponse
    {
        $this->ensureAdmin($request);
        $dept = $this->repository->findById($department);

        if ($dept === null) {
            throw ApiException::notFound('Department');
        }

        $this->service->delete($dept);

        return $this->respond(['deleted' => true], 'Department deleted.');
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
