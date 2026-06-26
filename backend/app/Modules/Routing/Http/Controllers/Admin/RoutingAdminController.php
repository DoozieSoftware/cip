<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Controllers\Admin;

use App\Modules\Routing\Http\Requests\ReorderRoutingRulesRequest;
use App\Modules\Routing\Http\Requests\StoreRoutingRuleRequest;
use App\Modules\Routing\Http\Requests\UpdateRoutingRuleRequest;
use App\Modules\Routing\Http\Resources\RoutingRuleResource;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\RoutingAdminService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super Admin CRUD for routing rules per docs/09 sec 12.
 *
 *  - GET    /api/v1/admin/routing-rules
 *  - POST   /api/v1/admin/routing-rules
 *  - GET    /api/v1/admin/routing-rules/{rule}
 *  - PUT    /api/v1/admin/routing-rules/{rule}
 *  - DELETE /api/v1/admin/routing-rules/{rule}
 *  - POST   /api/v1/admin/routing-rules/reorder
 *
 * Per AGENTS.md - no business logic here. All writes go
 * through `RoutingAdminService` which is the only place
 * that mutates `routing_rules` and writes the matching
 * `audit_logs` row.
 */
class RoutingAdminController extends BaseController
{
    public function __construct(
        private readonly RoutingAdminService $service,
    ) {}

    /**
     * GET /api/v1/admin/routing-rules
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

        $transformed = $page->through(
            static fn (RoutingRule $r): array => (new RoutingRuleResource($r))->toArray($request)
        );

        return $this->respondPaginated($transformed);
    }

    /**
     * POST /api/v1/admin/routing-rules
     */
    public function store(StoreRoutingRuleRequest $request): JsonResponse
    {
        $rule = $this->service->create($request->validated(), $request->user(), $request);

        return $this->respond(
            (new RoutingRuleResource($rule))->toArray($request),
            'Routing rule created.',
            201,
        );
    }

    /**
     * GET /api/v1/admin/routing-rules/{rule}
     */
    public function show(Request $request, string $rule): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = RoutingRule::query()->find($rule);

        if ($model === null) {
            throw ApiException::notFound('RoutingRule');
        }

        return $this->respond((new RoutingRuleResource($model))->toArray($request));
    }

    /**
     * PUT /api/v1/admin/routing-rules/{rule}
     */
    public function update(UpdateRoutingRuleRequest $request, string $rule): JsonResponse
    {
        $model = RoutingRule::query()->find($rule);

        if ($model === null) {
            throw ApiException::notFound('RoutingRule');
        }

        $model = $this->service->update($model, $request->validated(), $request->user(), $request);

        return $this->respond(
            (new RoutingRuleResource($model))->toArray($request),
            'Routing rule updated.',
        );
    }

    /**
     * DELETE /api/v1/admin/routing-rules/{rule}
     */
    public function destroy(Request $request, string $rule): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = RoutingRule::query()->find($rule);

        if ($model === null) {
            throw ApiException::notFound('RoutingRule');
        }

        $this->service->delete($model, $request->user(), $request);

        return $this->respond(['deleted' => true], 'Routing rule deleted.');
    }

    /**
     * POST /api/v1/admin/routing-rules/reorder
     */
    public function reorder(ReorderRoutingRulesRequest $request): JsonResponse
    {
        $this->service->reorder($request->validated()['order'], $request->user(), $request);

        return $this->respond(['reordered' => true], 'Routing rules reordered.');
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
