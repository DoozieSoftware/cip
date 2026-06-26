<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\DTO\CreateReportDto;
use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Shared\Exceptions\ApiException;

/**
 * ReportService per docs/03 §16 and docs/14 §8.
 *
 * Owns the business rules for report CRUD:
 *  - createDraft   : a new report in the `draft` status
 *  - updateDraft   : partial update (title / description /
 *                    department_id only) while still in `draft`
 *  - submit        : moves `draft → submitted`; emits
 *                    `ReportStatusChanged`; the listener appends
 *                    a `report_status_history` row
 *  - transitionTo  : generic state machine (used by the
 *                    Workflow engine in M6; the moderator / API
 *                    does not call this directly)
 *
 * Every public method returns the persisted `Report` model.
 */
class ReportService
{
    public function __construct(
        private readonly ReportRepository $repository,
        private readonly LocationService $locationService,
    ) {}

    public function createDraft(CreateReportDto $dto): Report
    {
        $this->assertReportTypeExists($dto->reportTypeId);
        $this->assertPriorityExists($dto->priorityId);
        $this->assertStatusExists($dto->currentStatusId);

        $report = $this->repository->create([
            'citizen_id' => $dto->citizenId,
            'report_type_id' => $dto->reportTypeId,
            'department_id' => $dto->departmentId,
            'current_status_id' => $dto->currentStatusId,
            'priority_id' => $dto->priorityId,
            'location_id' => $dto->locationId,
            'title' => $dto->title,
            'description' => $dto->description,
            'is_anonymous' => $dto->isAnonymous,
        ]);

        return $report;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateDraft(Report $report, array $attributes): Report
    {
        $currentStatus = $report->current_status_id;
        $isDraft = ReportStatus::query()
            ->where('id', $currentStatus)
            ->where('code', 'draft')
            ->exists();

        if (! $isDraft) {
            throw new ApiException('INVALID_STATUS', 'Only draft reports can be updated.', 422);
        }

        $patch = array_intersect_key($attributes, array_flip([
            'title', 'description', 'department_id', 'priority_id', 'location_id',
        ]));
        $patch = array_filter($patch, static fn ($v): bool => $v !== null);

        if ($patch === []) {
            return $report;
        }

        return $this->repository->update($report, $patch);
    }

    public function submit(SubmitReportDto $dto): Report
    {
        $this->assertReportTypeExists($dto->reportTypeId);
        $location = $this->locationService->createFromSubmission($dto);

        $draftStatusId = $this->resolveStatusId('draft');
        $submittedStatusId = $this->resolveStatusId('submitted');
        $priorityId = $dto->priorityId ?? $this->defaultPriorityId();

        $report = $this->repository->create([
            'citizen_id' => $dto->isAnonymous ? null : $dto->citizenId,
            'report_type_id' => $dto->reportTypeId,
            'current_status_id' => $draftStatusId,
            'priority_id' => $priorityId,
            'location_id' => $location->id,
            'title' => $dto->title,
            'description' => $dto->description,
            'is_anonymous' => $dto->isAnonymous,
        ]);

        $report = $this->transitionTo($report, $submittedStatusId, $dto->citizenId, 'Citizen submitted.', [
            'source' => 'citizen_mobile',
        ]);
        $report->submitted_at = now();
        $report->save();

        return $report->refresh();
    }

    public function transitionTo(
        Report $report,
        string $toStatusId,
        ?string $actorId = null,
        ?string $reason = null,
        array $metadata = [],
    ): Report {
        $fromId = $report->current_status_id;

        if ($fromId === $toStatusId) {
            return $report;
        }
        $this->assertStatusExists($toStatusId);

        $report->current_status_id = $toStatusId;
        $report->save();

        ReportStatusChanged::dispatch(
            reportId: $report->id,
            fromStatusId: $fromId,
            toStatusId: $toStatusId,
            actorId: $actorId,
            reason: $reason,
            metadata: $metadata,
        );

        return $report;
    }

    private function assertReportTypeExists(string $id): void
    {
        if (! ReportType::query()->where('id', $id)->exists()) {
            throw ApiException::notFound('ReportType');
        }
    }

    private function assertPriorityExists(string $id): void
    {
        if (! ReportPriority::query()->where('id', $id)->exists()) {
            throw ApiException::notFound('ReportPriority');
        }
    }

    private function assertStatusExists(string $id): void
    {
        if (! ReportStatus::query()->where('id', $id)->exists()) {
            throw ApiException::notFound('ReportStatus');
        }
    }

    private function resolveStatusId(string $code): string
    {
        $id = ReportStatus::query()->where('code', $code)->value('id');

        if (! is_string($id) || $id === '') {
            throw new ApiException(
                'MISSING_REFERENCE_DATA',
                "Status '{$code}' is not seeded.",
                500,
            );
        }

        return $id;
    }

    private function defaultPriorityId(): string
    {
        $id = ReportPriority::query()
            ->where('code', 'medium')
            ->value('id');

        if (! is_string($id) || $id === '') {
            throw new ApiException(
                'MISSING_REFERENCE_DATA',
                "Priority 'medium' is not seeded.",
                500,
            );
        }

        return $id;
    }
}
