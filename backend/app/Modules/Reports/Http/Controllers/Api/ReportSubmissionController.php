<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Http\Requests\SubmitReportRequest;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Reports\Services\ReportService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportSubmissionController extends BaseController
{
    public function __construct(
        private readonly ReportRepository $repository,
        private readonly ReportService $service,
    ) {}

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

        $submittedStatusId = $this->service->resolveStatusId('submitted');
        $draftStatusId = $this->service->resolveStatusId('draft');

        if ((string) $report->current_status_id === $submittedStatusId) {
            return $this->respond(
                (new ReportResource($report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
                'Report already submitted.',
            );
        }

        if ((string) $report->current_status_id !== $draftStatusId) {
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

    private function assertDepartmentScopeAllows(User $user, Report $report): void
    {
        if (! DepartmentScope::canViewReport($user, $report)) {
            throw ApiException::forbidden('This report is outside your department scope.');
        }
    }

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
