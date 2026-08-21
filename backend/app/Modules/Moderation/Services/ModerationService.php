<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Services;

use App\Modules\Departments\Models\ReportProofVerification;
use App\Modules\Moderation\DTO\ReviewReportDto;
use App\Modules\Moderation\Events\ReportModerated;
use App\Modules\Moderation\Events\ReportsMerged;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Routing\Services\AssignmentService;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Routing\Services\RoutingFallbackService;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\WorkflowEngine;
use Illuminate\Support\Facades\DB;

/**
 * M10 ModerationService.
 *
 * The single business-logic entry point for the moderator
 * surface. Implements the four decisions (approve, reject,
 * merge, escalate) on top of the M6 workflow engine + the
 * M4 report model. Every decision is:
 *
 *  - transactional (DB::transaction)
 *  - audited (a `report_moderated` AuditLog row with
 *    before/after of the changed columns)
 *  - broadcast as a domain event (ReportModerated /
 *    ReportsMerged) so notifications + analytics do not
 *    need to re-resolve the report
 *
 * The service does NOT own the workflow engine — it
 * delegates `evaluate()` + `apply()` to WorkflowEngine
 * so the M6 transition table remains the single source of
 * truth for which states are reachable from which.
 */
class ModerationService
{
    public function __construct(
        private readonly WorkflowEngine $engine,
        private readonly RoutingEngine $routing,
        private readonly AssignmentService $assignments,
        private readonly RoutingFallbackService $routingFallback,
    ) {}

    /**
     * Apply a moderator decision to a single report.
     *
     * @return Report the refreshed report, with `current_status_id`
     *                updated to the destination state.
     */
    public function review(Report $report, ReviewReportDto $dto, User $moderator): Report
    {
        $this->assertCanModerate($moderator);

        if ($dto->decision === ReviewReportDto::DECISION_MERGE) {
            // Merge is a special case — the canonical report id
            // must be present and different from the current one.
            return $this->mergeSingle($report, $dto, $moderator);
        }

        if ($dto->decision === ReviewReportDto::DECISION_COMPLETE_PROOF) {
            $statusCode = $report->status()->value('code');
            $hasProofReview = ReportProofVerification::query()
                ->where('report_id', $report->id)
                ->whereHas('proofMedia', fn ($query) => $query->where('is_replaced', false))
                ->exists();

            if ($statusCode !== 'resolved_pending_verification' || ! $hasProofReview) {
                throw ApiException::validation(
                    'Proof completion is available only when a completion proof is awaiting moderator review.',
                    ['decision' => ['No pending proof review exists for this report.']],
                );
            }
        }

        $event = $this->eventFor($dto->decision);

        $decision = $this->engine->evaluate($report, $event, $moderator);

        if (! $decision->allowed) {
            $status = $report->status()->first();
            $statusCode = $status !== null ? $status->code : 'unknown';

            throw ApiException::validation(
                "Cannot {$dto->decision} report from state '{$statusCode}'.",
                ['decision' => $decision->reasons],
            );
        }

        $fromStatusId = $report->current_status_id;
        $fromCategoryId = $report->report_type_id ?? null;
        $fromDepartmentId = $report->department_id;

        $refreshed = DB::transaction(function () use ($report, $dto, $decision, $moderator, $fromStatusId, $fromCategoryId, $fromDepartmentId): Report {
            $this->applyCategoryOverride($report, $dto);
            $this->applyDepartmentOverride($report, $dto);

            $routingDecision = null;

            if (
                $dto->decision === ReviewReportDto::DECISION_APPROVE
                && $report->department_id === null
                && ! $report->assignments()->openPrimary()->exists()
            ) {
                $routingDecision = $this->routing->resolve($report)
                    ?? $this->routingFallback->decisionFor($report);
            }

            $this->engine->apply(
                $report,
                $decision,
                $moderator,
                expectedWorkflowVersion: $dto->expectedWorkflowVersion,
            );

            if ($routingDecision !== null) {
                $this->assignments->assign($report, $routingDecision, $moderator, reason: 'moderator_approve_routing');
            }

            $toStatusId = $report->current_status_id;
            $toCategoryId = $report->report_type_id ?? null;
            $toDepartmentId = $report->department_id;

            $this->writeAudit(
                $report,
                $moderator,
                action: 'report.moderated',
                before: [
                    'current_status_id' => $fromStatusId,
                    'report_type_id' => $fromCategoryId,
                    'department_id' => $fromDepartmentId,
                ],
                after: [
                    'current_status_id' => $toStatusId,
                    'report_type_id' => $toCategoryId,
                    'department_id' => $toDepartmentId,
                ],
                extra: [
                    'decision' => $dto->decision,
                    'override_ai' => $dto->overrideAi,
                    'reason_code' => $dto->reasonCode,
                ],
            );

            ReportModerated::dispatch(
                reportId: $report->id,
                decision: $dto->decision,
                fromStatusId: $fromStatusId,
                toStatusId: $toStatusId,
                fromCategoryId: $fromCategoryId,
                toCategoryId: $toCategoryId,
                fromDepartmentId: $fromDepartmentId,
                toDepartmentId: $toDepartmentId,
                remarks: $dto->remarks,
                overrideAi: $dto->overrideAi,
                reasonCode: $dto->reasonCode,
                mergeIntoReportId: null,
                actorId: $moderator->id,
            );

            return $report->refresh();
        });

        return $refreshed;
    }

    /**
     * Merge the source report into a canonical report.
     * The source is closed (status -> `merged`); the canonical
     * is unchanged. Both rows are kept — the citizen's tracking
     * page surfaces the merge on the duplicate row.
     *
     * @param  list<string>  $duplicateIds
     * @param  array<string, int>  $expectedDuplicateVersions
     * @return list<string> ids of the duplicates actually merged
     */
    public function merge(
        string $canonicalId,
        array $duplicateIds,
        ?string $remarks,
        ?string $reasonCode,
        User $moderator,
        ?int $expectedCanonicalVersion = null,
        array $expectedDuplicateVersions = [],
    ): array {
        $this->assertCanModerate($moderator);

        $merged = DB::transaction(function () use ($canonicalId, $duplicateIds, $remarks, $reasonCode, $moderator, $expectedCanonicalVersion, $expectedDuplicateVersions): array {
            $orderedDuplicateIds = array_values(array_unique(array_filter(
                $duplicateIds,
                static fn (mixed $id): bool => is_string($id) && $id !== '' && $id !== $canonicalId,
            )));
            // Lock every participating report in stable UUID order. Without
            // this, two inverse merge requests can each lock their canonical
            // first and deadlock while waiting for the other's duplicate.
            $lockIds = array_values(array_unique([$canonicalId, ...$orderedDuplicateIds]));
            sort($lockIds);
            $lockedReports = Report::query()
                ->whereIn('id', $lockIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $canonical = $lockedReports->get($canonicalId);

            if (! $canonical instanceof Report) {
                throw ApiException::validation("Canonical complaint '{$canonicalId}' not found.", ['canonical_id' => [$canonicalId]]);
            }

            if ($expectedCanonicalVersion !== null && $canonical->workflow_version !== $expectedCanonicalVersion) {
                throw new ApiException(
                    'REPORT_VERSION_CONFLICT',
                    'The report changed after it was loaded. Refresh and try again.',
                    409,
                    [
                        'expected_workflow_version' => $expectedCanonicalVersion,
                        'actual_workflow_version' => $canonical->workflow_version,
                    ],
                );
            }

            $merged = [];
            $mergedStatus = ReportStatus::query()->where('code', 'merged')->first();

            foreach ($orderedDuplicateIds as $dupId) {
                $dup = $lockedReports->get($dupId);

                if (! $dup instanceof Report) {
                    continue;
                }

                $expectedDuplicateVersion = $expectedDuplicateVersions[$dupId] ?? null;

                if (is_int($expectedDuplicateVersion) && $dup->workflow_version !== $expectedDuplicateVersion) {
                    throw new ApiException(
                        'REPORT_VERSION_CONFLICT',
                        'A duplicate report changed after it was loaded. Refresh and try again.',
                        409,
                        [
                            'report_id' => $dupId,
                            'expected_workflow_version' => $expectedDuplicateVersion,
                            'actual_workflow_version' => $dup->workflow_version,
                        ],
                    );
                }

                if ($dup->merged_into !== null) {
                    throw new ApiException(
                        'REPORT_VERSION_CONFLICT',
                        'A duplicate report has already been merged. Refresh and try again.',
                        409,
                        [
                            'report_id' => $dupId,
                            'actual_workflow_version' => $dup->workflow_version,
                        ],
                    );
                }

                $fromStatus = $dup->current_status_id;
                $beforeVersion = $dup->workflow_version;

                if ($mergedStatus !== null) {
                    $dup->current_status_id = $mergedStatus->id;
                    $dup->merged_into = $canonical->id;
                    $dup->merged_at = now();
                    $dup->workflow_version = $beforeVersion + 1;
                    $dup->save();

                    // This bypasses WorkflowEngine::apply() (a duplicate can be
                    // merged from any state, not just the transitions the
                    // engine's `merge` event is gated to), so it must dispatch
                    // ReportStatusChanged itself — otherwise no
                    // report_status_history row is written, ModerationAnalyticsService's
                    // merged_today count stays permanently 0, and the merged
                    // report's own timeline is missing its final transition.
                    ReportStatusChanged::dispatch(
                        $dup->id,
                        $fromStatus,
                        $mergedStatus->id,
                        $moderator->id,
                        $reasonCode ?? 'merged_into_canonical',
                        ['canonical_report_id' => $canonical->id],
                    );
                }
                $this->writeAudit(
                    $dup,
                    $moderator,
                    action: 'report.merged',
                    before: ['current_status_id' => $fromStatus, 'workflow_version' => $beforeVersion],
                    after: ['current_status_id' => $dup->current_status_id, 'merged_into' => $canonical->id, 'workflow_version' => $dup->workflow_version],
                    extra: [
                        'canonical_report_id' => $canonical->id,
                        'reason_code' => $reasonCode,
                    ],
                );
                $merged[] = $dup->id;
            }

            if ($merged !== []) {
                $canonicalBeforeVersion = $canonical->workflow_version;
                $canonical->workflow_version = $canonicalBeforeVersion + 1;
                $canonical->save();

                $this->writeAudit(
                    $canonical,
                    $moderator,
                    action: 'report.canonical_for_merge',
                    before: ['workflow_version' => $canonicalBeforeVersion],
                    after: ['merged_duplicates' => $merged, 'workflow_version' => $canonical->workflow_version],
                    extra: ['reason_code' => $reasonCode],
                );
            }

            ReportsMerged::dispatch(
                canonicalReportId: $canonical->id,
                duplicateReportIds: $merged,
                actorId: $moderator->id,
                remarks: $remarks,
                reasonCode: $reasonCode,
            );

            return $merged;
        });

        return $merged;
    }

    /**
     * Internal helper for the merge branch of `review()` when the
     * moderator picks merge via the per-report endpoint. Treats
     * the report under review as the duplicate and the
     * `merge_into_report_id` field as the canonical.
     */
    private function mergeSingle(Report $report, ReviewReportDto $dto, User $moderator): Report
    {
        if ($dto->mergeIntoReportId === null || $dto->mergeIntoReportId === '') {
            throw ApiException::validation('merge requires merge_into_report_id.', ['merge_into_report_id' => []]);
        }

        if ($dto->mergeIntoReportId === $report->id) {
            throw ApiException::validation('a complaint cannot be merged into itself.', ['merge_into_report_id' => [$report->id]]);
        }

        $this->merge(
            $dto->mergeIntoReportId,
            [$report->id],
            $dto->remarks,
            $dto->reasonCode,
            $moderator,
            expectedDuplicateVersions: $dto->expectedWorkflowVersion === null
                ? []
                : [$report->id => $dto->expectedWorkflowVersion],
        );

        return $report->refresh();
    }

    /**
     * Map a ReviewReportDto decision to the M6 workflow event name.
     */
    private function eventFor(string $decision): string
    {
        return match ($decision) {
            ReviewReportDto::DECISION_APPROVE => 'approve',
            ReviewReportDto::DECISION_REJECT => 'reject',
            ReviewReportDto::DECISION_ESCALATE => 'escalate',
            ReviewReportDto::DECISION_COMPLETE_PROOF => 'close',
            default => throw ApiException::validation("decision '{$decision}' is not a single-report event.", ['decision' => [$decision]]),
        };
    }

    private function applyCategoryOverride(Report $report, ReviewReportDto $dto): void
    {
        if ($dto->categoryId !== null && $dto->categoryId !== '') {
            $report->report_type_id = $dto->categoryId;
            $report->save();
        }
    }

    private function applyDepartmentOverride(Report $report, ReviewReportDto $dto): void
    {
        if ($dto->departmentId !== null && $dto->departmentId !== '') {
            $report->department_id = $dto->departmentId;
            $report->save();
        }
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>  $extra
     */
    private function writeAudit(Report $report, User $moderator, string $action, ?array $before, array $after, array $extra = []): void
    {
        AuditLog::query()->create([
            'user_id' => $moderator->id,
            'entity' => Report::class,
            'entity_id' => $report->id,
            'action' => $action,
            'before' => $before,
            'after' => array_merge($after, $extra),
            'ip' => null,
            'device_fingerprint' => null,
            'request_id' => null,
            'created_at' => now(),
        ]);
    }

    private function assertCanModerate(User $moderator): void
    {
        if (! $moderator->hasAnyRole(['moderator', 'super_admin', 'system'])) {
            throw ApiException::validation('User is not authorised to moderate reports.', ['moderator' => [$moderator->id]]);
        }
    }
}
