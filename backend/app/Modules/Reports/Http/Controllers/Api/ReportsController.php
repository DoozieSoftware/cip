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
        $dto = new SubmitReportDto(
            citizenId: (string) $user->id,
            reportTypeId: (string) $request->validated('report_type_id'),
            latitude: (float) $request->validated('latitude'),
            longitude: (float) $request->validated('longitude'),
            accuracy: $request->validated('accuracy') === null ? null : (float) $request->validated('accuracy'),
            altitude: $request->validated('altitude') === null ? null : (float) $request->validated('altitude'),
            heading: $request->validated('heading') === null ? null : (float) $request->validated('heading'),
            speed: $request->validated('speed') === null ? null : (float) $request->validated('speed'),
            gpsProvider: $request->validated('gps_provider'),
            capturedAt: $request->validated('captured_at'),
            title: (string) $request->validated('title'),
            description: (string) $request->validated('description'),
            isAnonymous: (bool) $request->validated('is_anonymous', false),
            priorityId: $request->validated('priority_id'),
            mockGpsScore: $request->validated('mock_gps_score') === null ? null : (float) $request->validated('mock_gps_score'),
        );

        $report = $this->service->submit($dto);

        return $this->respond(
            (new ReportResource($report->fresh()->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
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
        $report = $this->repository->findById($id);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user->hasAnyRole(['moderator', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot submit this report.');
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

        return $this->respond(
            (new ReportResource($report->fresh()->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
            'Report submitted.',
        );
    }

    /**
     * GET /api/v1/reports
     */
    public function index(Request $request): JsonResponse
    {
        $this->ensureStaff($request);
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

        $page = $this->repository->searchByRole($filters, perPage: (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (Report $r): array => (new ReportResource($r))->toArray($request));

        return $this->respondPaginated($transformed);
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
        $isStaff = $user !== null && $user->hasAnyRole(['moderator', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot view this timeline.');
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
        $citizenId = (string) $user->id;

        $counts = $this->repository->citizenDashboardCounts($citizenId);

        return $this->respond($counts);
    }

    /**
     * GET /api/v1/citizen/reports
     */
    public function citizenIndex(Request $request): JsonResponse
    {
        $user = $request->user();
        $filters = [
            'status' => $request->query('status'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'search' => $request->query('q'),
        ];
        $filters = array_filter($filters, static fn ($v): bool => $v !== null && $v !== '');

        $page = $this->repository->searchForCitizen($user, $filters, perPage: (int) $request->query('per_page', 25));
        $transformed = $page->through(static fn (Report $r): array => (new ReportResource($r))->toArray($request));

        return $this->respondPaginated($transformed);
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
        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;

        if (! $isOwner && ! $user->hasAnyRole(['moderator', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('You cannot view this report.');
        }

        return $this->respond(
            (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
        );
    }

    private function ensureStaff(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasAnyRole(['moderator', 'department', 'super_admin', 'system'])) {
            throw ApiException::forbidden('Staff role is required.');
        }
    }
}
