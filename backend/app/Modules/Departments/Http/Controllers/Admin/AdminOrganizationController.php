<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Admin;

use App\Modules\Departments\Http\Requests\Admin\StoreOrganizationRequest;
use App\Modules\Departments\Http\Requests\Admin\UpdateOrganizationRequest;
use App\Modules\Departments\Http\Resources\Admin\OrganizationResource;
use App\Modules\Departments\Models\Organization;
use App\Modules\Departments\Repositories\OrganizationRepository;
use App\Modules\Departments\Services\OrganizationAdminService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-013 — Super Admin CRUD for organizations per
 * `docs/09` §6 (multi-tenant scaffold).
 *
 *  - GET    /api/v1/admin/organizations
 *  - POST   /api/v1/admin/organizations
 *  - GET    /api/v1/admin/organizations/{organization}
 *  - PUT    /api/v1/admin/organizations/{organization}
 *  - DELETE /api/v1/admin/organizations/{organization}   (soft delete)
 *  - POST   /api/v1/admin/organizations/{organization}/restore
 */
class AdminOrganizationController extends BaseController
{
    public function __construct(
        private readonly OrganizationRepository $repository,
        private readonly OrganizationAdminService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'active' => $request->query('active') === null
                ? null
                : filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, (int) $request->query('per_page', 25));
        $transformed = $page->through(
            static fn (Organization $o): array => (new OrganizationResource($o))->toArray($request),
        );

        return $this->respondPaginated($transformed);
    }

    public function store(StoreOrganizationRequest $request): JsonResponse
    {
        $row = $this->service->create($request->validated());

        return $this->respond(
            (new OrganizationResource($row))->toArray($request),
            'Organization created.',
            201,
        );
    }

    public function show(Request $request, string $organization): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($organization, withTrashed: true);

        return $this->respond((new OrganizationResource($row))->toArray($request));
    }

    public function update(UpdateOrganizationRequest $request, string $organization): JsonResponse
    {
        $row = $this->find($organization);
        $updated = $this->service->update($row, $request->validated());

        return $this->respond(
            (new OrganizationResource($updated))->toArray($request),
            'Organization updated.',
        );
    }

    public function destroy(Request $request, string $organization): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($organization);
        $this->service->delete($row);

        return $this->respond(null, 'Organization deleted.', 200);
    }

    public function restore(Request $request, string $organization): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($organization, withTrashed: true);

        if ($row->deleted_at === null) {
            throw ApiException::conflict('Organization is not deleted.');
        }

        $restored = $this->service->restore($row);

        return $this->respond(
            (new OrganizationResource($restored))->toArray($request),
            'Organization restored.',
        );
    }

    private function find(string $id, bool $withTrashed = false): Organization
    {
        $q = Organization::query();
        if ($withTrashed) {
            $q->withTrashed();
        }
        $row = $q->where('id', $id)->first();
        if ($row === null) {
            throw ApiException::notFound('Organization');
        }

        return $row;
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
