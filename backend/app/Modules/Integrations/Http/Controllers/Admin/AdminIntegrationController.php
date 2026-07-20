<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Http\Controllers\Admin;

use App\Modules\Integrations\Http\Requests\StoreIntegrationRequest;
use App\Modules\Integrations\Http\Requests\UpdateIntegrationRequest;
use App\Modules\Integrations\Http\Resources\IntegrationResource;
use App\Modules\Integrations\Models\Integration;
use App\Modules\Integrations\Repositories\IntegrationRepository;
use App\Modules\Integrations\Services\IntegrationAdminService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-007 — Super Admin CRUD for external system
 * connectors per `docs/12` §34.
 *
 *  - GET    /api/v1/admin/integrations
 *  - POST   /api/v1/admin/integrations
 *  - GET    /api/v1/admin/integrations/{integration}
 *  - PUT    /api/v1/admin/integrations/{integration}
 *  - DELETE /api/v1/admin/integrations/{integration}    (soft delete)
 *  - POST   /api/v1/admin/integrations/{integration}/restore
 *  - POST   /api/v1/admin/integrations/{integration}/health
 *
 * `credentials` are masked on every read. Writes are
 * accepted in clear and persisted as JSON.
 */
class AdminIntegrationController extends BaseController
{
    public function __construct(
        private readonly IntegrationRepository $repository,
        private readonly IntegrationAdminService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'status' => $request->query('status'),
            'provider' => $request->query('provider'),
            'include_trashed' => filter_var($request->query('include_trashed'), FILTER_VALIDATE_BOOLEAN),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (Integration $i): array => (new IntegrationResource($i))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    public function store(StoreIntegrationRequest $request): JsonResponse
    {
        $row = $this->service->create($request->validated());

        return $this->respond(
            (new IntegrationResource($row))->toArray($request),
            'Integration created.',
            201,
        );
    }

    public function show(Request $request, string $integration): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($integration, withTrashed: true);

        return $this->respond((new IntegrationResource($row))->toArray($request));
    }

    public function update(UpdateIntegrationRequest $request, string $integration): JsonResponse
    {
        $row = $this->find($integration);
        $updated = $this->service->update($row, $request->validated());

        return $this->respond(
            (new IntegrationResource($updated))->toArray($request),
            'Integration updated.',
        );
    }

    public function destroy(Request $request, string $integration): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($integration);
        $this->service->delete($row);

        return $this->respond(null, 'Integration deleted.', 200);
    }

    public function restore(Request $request, string $integration): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($integration, withTrashed: true);

        if ($row->deleted_at === null) {
            throw ApiException::conflict('Integration is not deleted.');
        }

        $restored = $this->service->restore($row);

        return $this->respond(
            (new IntegrationResource($restored))->toArray($request),
            'Integration restored.',
        );
    }

    public function health(Request $request, string $integration): JsonResponse
    {
        $this->ensureAdmin($request);
        $row = $this->find($integration);
        $probed = $this->service->probe($row);

        return $this->respond(
            (new IntegrationResource($probed))->toArray($request),
            'Health probe complete.',
        );
    }

    private function find(string $id, bool $withTrashed = false): Integration
    {
        $q = Integration::query();

        if ($withTrashed) {
            $q->withTrashed();
        }
        $row = $q->where('id', $id)->first();

        if ($row === null) {
            throw ApiException::notFound('Integration');
        }

        return $row;
    }
}
