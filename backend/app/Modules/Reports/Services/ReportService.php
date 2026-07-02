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
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use App\Modules\Workflow\Services\WorkflowEngine;

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
    /**
     * Mirrors the citizen PWA's `mockGpsLikely()` threshold
     * (`frontend/src/portals/citizen/security/mockGps.ts`) — a score
     * at or above this is "likely mock" and worth a security event,
     * but never a reason to auto-reject the report.
     */
    private const MOCK_GPS_LIKELY_THRESHOLD = 0.5;

    public function __construct(
        private readonly ReportRepository $repository,
        private readonly LocationService $locationService,
        private readonly WorkflowEngine $workflowEngine,
        private readonly WorkflowRepository $workflowRepository,
        private readonly SecurityEventService $securityEvents,
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
        $priorityId = $dto->priorityId ?? $this->defaultPriorityId();

        // Anchor the report to the default civic workflow so the
        // M6 engine can drive it through the lifecycle.
        $workflow = $this->workflowRepository->findActiveByCode('civic_default');

        $report = $this->repository->create([
            'citizen_id' => $dto->isAnonymous ? null : $dto->citizenId,
            'report_type_id' => $dto->reportTypeId,
            'current_status_id' => $draftStatusId,
            'priority_id' => $priorityId,
            'location_id' => $location->id,
            'workflow_id' => $workflow?->id,
            'title' => $dto->title,
            'description' => $dto->description,
            'is_anonymous' => $dto->isAnonymous,
            'mock_gps_score' => $dto->mockGpsScore,
        ]);

        // Drive the citizen's submit through the workflow
        // engine so the audit + event chain stays consistent
        // with every other transition.
        $actor = $dto->isAnonymous
            ? null
            : User::query()->find($dto->citizenId);
        $decision = $this->workflowEngine->evaluate($report, 'submit', $actor);

        if ($decision->allowed) {
            $report = $this->workflowEngine->apply($report, $decision, $actor);
        }

        $report->submitted_at = now();
        $report->save();

        // Never auto-rejects — only records a security event for the
        // dashboard + moderator triage. The FraudScorer pipeline reads
        // this same column later via AiPipelineOrchestrator.
        if ($dto->mockGpsScore !== null && $dto->mockGpsScore >= self::MOCK_GPS_LIKELY_THRESHOLD) {
            $this->securityEvents->recordSafe(
                'mock_gps',
                SecurityEventService::SEVERITY_WARNING,
                ['report_id' => $report->id, 'score' => $dto->mockGpsScore],
                $actor,
            );
        }

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
