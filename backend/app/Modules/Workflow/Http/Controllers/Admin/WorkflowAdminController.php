<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Workflow\Http\Requests\StoreWorkflowRequest;
use App\Modules\Workflow\Http\Requests\UpdateTransitionRequest;
use App\Modules\Workflow\Http\Resources\WorkflowResource;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Services\WorkflowAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super Admin CRUD for workflow definitions per docs/09 sec 11.
 *
 *  - GET    /api/v1/admin/workflows
 *  - POST   /api/v1/admin/workflows
 *  - GET    /api/v1/admin/workflows/{workflow}
 *  - PUT    /api/v1/admin/workflows/{workflow}
 *  - DELETE /api/v1/admin/workflows/{workflow}
 *
 * Per AGENTS.md - no business logic here. All writes go
 * through WorkflowAdminService. The `super_admin` role
 * gate is on each Form Request's authorize() and the
 * `index` / `show` / `destroy` endpoints guard via
 * `ensureAdmin()` for consistency.
 */
class WorkflowAdminController extends BaseController
{
    public function __construct(
        private readonly WorkflowAdminService $service,
    ) {}

    /**
     * GET /api/v1/admin/workflows
     */
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

        $page = $this->service->buildSearchQuery($filters)
            ->paginate(perPage: (int) $request->query('per_page', 25));

        $transformed = $page->through(static fn (WorkflowDefinition $d): array => (new WorkflowResource($d))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    /**
     * POST /api/v1/admin/workflows
     */
    public function store(StoreWorkflowRequest $request): JsonResponse
    {
        $def = $this->service->create($request->validated());

        return $this->respond(
            (new WorkflowResource($def))->toArray($request),
            'Workflow created.',
            201,
        );
    }

    /**
     * GET /api/v1/admin/workflows/{workflow}
     */
    public function show(Request $request, string $workflow): JsonResponse
    {
        $this->ensureAdmin($request);
        $def = WorkflowDefinition::query()->with(['states', 'transitions'])->find($workflow);

        if ($def === null) {
            throw ApiException::notFound('Workflow');
        }

        return $this->respond((new WorkflowResource($def))->toArray($request));
    }

    /**
     * PUT /api/v1/admin/workflows/{workflow}
     */
    public function update(UpdateTransitionRequest $request, string $workflow): JsonResponse
    {
        $def = WorkflowDefinition::query()->find($workflow);

        if ($def === null) {
            throw ApiException::notFound('Workflow');
        }

        $def = $this->service->update($def, $request->validated());

        return $this->respond(
            (new WorkflowResource($def))->toArray($request),
            'Workflow updated.',
        );
    }

    /**
     * DELETE /api/v1/admin/workflows/{workflow}
     *
     * Soft-deletes the definition (and its states /
     * transitions). The default civic workflow is
     * protected - use the `active` flag via PUT instead.
     */
    public function destroy(Request $request, string $workflow): JsonResponse
    {
        $this->ensureAdmin($request);
        $def = WorkflowDefinition::query()->find($workflow);

        if ($def === null) {
            throw ApiException::notFound('Workflow');
        }

        $this->service->delete($def);

        return $this->respond(['deleted' => true], 'Workflow deleted.');
    }
}
