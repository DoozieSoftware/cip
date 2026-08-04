<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Http\Requests\SubmitReportRequest;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Http\Resources\ReportStatusHistoryResource;
use App\Modules\Reports\Http\Resources\ReportTypeResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Reports\Services\ReportService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ReportsController per docs/05 §6, §7 and docs/09 §7.
 *
 *  - POST   /api/v1/reports              → create + submit (citizen)
 *  - GET    /api/v1/reports              → staff search (moderator / super_admin)
 *  - GET    /api/v1/reports/{id}         → staff read
 *  - GET    /api/v1/reports/{id}/timeline → staff timeline
 *  - GET    /api/v1/citizen/dashboard    → citizen dashboard counts
 *  - GET    /api/v1/citizen/reports      → citizen own-reports list
 *
 * Per AGENTS.md — no business logic here. All writes go through
 * ReportService (which emits the status-changed events). The
 * ReportPolicy gates every read.
 */
class ReportsController extends BaseController
{
    public function __construct(
        private readonly ReportRepository $repository,
        private readonly ReportService $service,
    ) {}

    /**
     * GET /api/v1/report-types — citizen-facing list of active report types.
     *
     * Returns all active report types for the citizen submit form.
     * Unlike the admin endpoint, this does not require super_admin role
     * and only returns active (non-trashed) types.
     */
    public function reportTypes(Request $request): JsonResponse
    {
        $types = ReportType::query()
            ->where('active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respond(
            $types->map(static fn (ReportType $t): array => (new ReportTypeResource($t))->toArray($request))->all(),
        );
    }

    /**
     * POST /api/v1/reports
     */
    public function store(SubmitReportRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $dto = new SubmitReportDto(
            citizenId: (string) $user->id,
            reportTypeId: $this->requiredString($request, 'report_type_id'),
            latitude: $this->requiredFloat($request, 'latitude'),
            longitude: $this->requiredFloat($request, 'longitude'),
            accuracy: $this->nullableFloat($request, 'accuracy'),
            altitude: $this->nullableFloat($request, 'altitude'),
            heading: $this->nullableFloat($request, 'heading'),
            speed: $this->nullableFloat($request, 'speed'),
            gpsProvider: $this->nullableString($request, 'gps_provider'),
            capturedAt: $this->nullableDateTime($request, 'captured_at'),
            address: $this->nullableString($request, 'address'),
            title: $this->requiredString($request, 'title'),
            description: $this->requiredString($request, 'description'),
            isAnonymous: (bool) $request->validated('is_anonymous', false),
            priorityId: $this->nullableString($request, 'priority_id'),
            mockGpsScore: $this->nullableFloat($request, 'mock_gps_score'),
        );

        $report = $this->service->submit($dto);
        $fresh = $report->fresh();

        if ($fresh === null) {
            throw ApiException::notFound('Report');
        }

        return $this->respond(
            (new ReportResource($fresh->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
            'Report submitted.',
            201,
        );
    }

    /**
     * POST /api/v1/reports/{id}/submit
     */
    public function submit(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot submit this report.');
        }

        if (! $isOwner) {
            $this->assertDepartmentScopeAllows($user, $report);
        }

        $submittedStatusId = ReportStatus::query()
            ->where('code', 'submitted')
            ->value('id');
        $draftStatusId = ReportStatus::query()
            ->where('code', 'draft')
            ->value('id');

        if (! is_string($submittedStatusId) || $submittedStatusId === '') {
            throw new ApiException('MISSING_REFERENCE_DATA', "Status 'submitted' is not seeded.", 500);
        }

        if ((string) $report->current_status_id === $submittedStatusId) {
            return $this->respond(
                (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
                'Report already submitted.',
            );
        }

        if (is_string($draftStatusId) && $draftStatusId !== '' && (string) $report->current_status_id !== $draftStatusId) {
            throw new ApiException('INVALID_STATUS', 'Only draft reports can be submitted.', 422);
        }

        $report = $this->service->transitionTo($report, $submittedStatusId, (string) $user->id, 'Citizen submitted.', ['source' => 'citizen_submit_endpoint']);
        $report->submitted_at = now();
        $report->save();

        $fresh = $report->fresh();

        if ($fresh === null) {
            throw ApiException::notFound('Report');
        }

        return $this->respond(
            (new ReportResource($fresh->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
            'Report submitted.',
        );
    }

    /**
     * GET /api/v1/reports
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureStaff($request);

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $filters = [
            'status' => $request->query('status'),
            'department' => $request->query('department'),
            'ward' => $request->query('ward'),
            'priority' => $request->query('priority'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'search' => $request->query('q'),
            'sort' => $request->query('sort'),
            'dir' => $request->query('dir'),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        // Phase 1 isolation: department staff only see their own
        // departments' reports; unrestricted staff see everything.
        $scope = DepartmentScope::isDepartmentScopedStaff($user)
            ? DepartmentScope::memberDepartmentIds($user)
            : null;

        $page = $this->repository->searchByRole(
            $filters,
            perPage: (int) $request->query('per_page', 25),
            departmentScope: $scope,
        );

        $items = $page->getCollection()
            ->map(static fn (Report $r): array => (new ReportResource($r))->toArray($request))
            ->values()
            ->all();

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /**
     * GET /api/v1/reports/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $this->ensureStaff($request);
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $this->assertDepartmentScopeAllows($user, $report);

        return $this->respond(
            (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
        );
    }

    /**
     * GET /api/v1/reports/{id}/timeline
     */
    public function timeline(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $user = $request->user();
        $isOwner = $user !== null
            && ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user !== null && $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot view this timeline.');
        }

        if (! $isOwner && $user !== null) {
            $this->assertDepartmentScopeAllows($user, $report);
        }

        $rows = $this->repository->paginateTimeline($id);
        $payload = $rows->map(static fn ($row): array => (new ReportStatusHistoryResource($row))->toArray($request))->values()->all();

        return $this->respond($payload);
    }

    /**
     * GET /api/v1/citizen/dashboard
     */
    public function citizenDashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $counts = $this->repository->citizenDashboardCounts((string) $user->id);

        return $this->respond($counts);
    }

    /**
     * GET /api/v1/citizen/reports
     */
    public function citizenIndex(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $filters = [
            'status' => $request->query('status'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'search' => $request->query('q'),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->searchForCitizen($user, $filters, perPage: (int) $request->query('per_page', 25));

        $items = $page->getCollection()
            ->map(static fn (Report $r): array => (new ReportResource($r))->toArray($request))
            ->values()
            ->all();

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /**
     * GET /api/v1/citizen/reports/{id}
     */
    public function citizenShow(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;

        if (! $isOwner && ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('You cannot view this report.');
        }

        if (! $isOwner) {
            $this->assertDepartmentScopeAllows($user, $report);
        }

        return $this->respond(
            (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
        );
    }

    private function ensureStaff(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('Staff role is required.');
        }
    }

    /**
     * Phase 1 isolation: department-scoped staff may only read reports
     * their departments own (or hold an open assignment on). Unrestricted
     * staff pass through.
     */
    private function assertDepartmentScopeAllows(User $user, Report $report): void
    {
        if (! DepartmentScope::canViewReport($user, $report)) {
            throw ApiException::forbidden('This report is outside your department scope.');
        }
    }

    /**
     * Typed accessors for validated request values. Form-request validation
     * has already enforced presence/type; these helpers keep DTO
     * construction type-safe.
     */
    private function requiredString(SubmitReportRequest $request, string $key): string
    {
        $value = $request->validated($key);

        return is_string($value) ? $value : '';
    }

    private function requiredFloat(SubmitReportRequest $request, string $key): float
    {
        $value = $request->validated($key);

        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function nullableString(SubmitReportRequest $request, string $key): ?string
    {
        $value = $request->validated($key);

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function nullableFloat(SubmitReportRequest $request, string $key): ?float
    {
        $value = $request->validated($key);

        return is_numeric($value) ? (float) $value : null;
    }

    private function nullableDateTime(SubmitReportRequest $request, string $key): ?\DateTimeInterface
    {
        $value = $request->validated($key);

        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return new \DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }
}
