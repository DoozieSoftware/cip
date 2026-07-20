<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Admin;

use App\Modules\Reports\Http\Requests\Admin\StoreReportTypeRequest;
use App\Modules\Reports\Http\Requests\Admin\UpdateReportTypeRequest;
use App\Modules\Reports\Http\Resources\ReportTypeResource;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Repositories\ReportTypeRepository;
use App\Modules\Reports\Services\AdminReportTypeService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-003 — Super Admin report-type CRUD per `docs/09` §6.
 *
 *  - GET    /api/v1/admin/report-types
 *  - POST   /api/v1/admin/report-types
 *  - GET    /api/v1/admin/report-types/{report_type}
 *  - PUT    /api/v1/admin/report-types/{report_type}
 *  - DELETE /api/v1/admin/report-types/{report_type}    (soft delete)
 *  - POST   /api/v1/admin/report-types/{report_type}/restore
 *
 * The `code` field is the immutable-ish slug the citizen PWA
 * and the routing engine depend on; validation enforces
 * uniqueness on create and uniqueness-skipping-self on update.
 */
class AdminReportTypeController extends BaseController
{
    public function __construct(
        private readonly ReportTypeRepository $repository,
        private readonly AdminReportTypeService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $filters = [
            'q' => $request->query('q'),
            'active' => $request->query('active'),
            'include_trashed' => filter_var($request->query('include_trashed'), FILTER_VALIDATE_BOOLEAN),
            'only_trashed' => filter_var($request->query('only_trashed'), FILTER_VALIDATE_BOOLEAN),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->search($filters, (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (ReportType $t): array => (new ReportTypeResource($t))->toArray($request));

        return $this->respondPaginated($transformed);
    }

    public function store(StoreReportTypeRequest $request): JsonResponse
    {
        $type = $this->service->create($request->validated());

        return $this->respond(
            (new ReportTypeResource($type))->toArray($request),
            'Report type created.',
            201,
        );
    }

    public function show(Request $request, string $reportType): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findType($reportType, withTrashed: true);

        return $this->respond((new ReportTypeResource($model))->toArray($request));
    }

    public function update(UpdateReportTypeRequest $request, string $reportType): JsonResponse
    {
        $model = $this->findType($reportType);
        $updated = $this->service->update($model, $request->validated());

        return $this->respond(
            (new ReportTypeResource($updated))->toArray($request),
            'Report type updated.',
        );
    }

    public function destroy(Request $request, string $reportType): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findType($reportType);
        $this->service->delete($model);

        return $this->respond(null, 'Report type deleted.', 200);
    }

    public function restore(Request $request, string $reportType): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->findType($reportType, withTrashed: true);

        if ($model->deleted_at === null) {
            throw ApiException::conflict('Report type is not deleted.');
        }
        $model->restore();

        return $this->respond((new ReportTypeResource($model))->toArray($request), 'Report type restored.');
    }

    private function findType(string $id, bool $withTrashed = false): ReportType
    {
        $q = ReportType::query();

        if ($withTrashed) {
            $q->withTrashed();
        }
        $model = $q->where('id', $id)->first();

        if ($model === null) {
            throw ApiException::notFound('Report type');
        }

        return $model;
    }
}
