<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Services;

use App\Modules\Moderation\DTO\ReviewReportDto;
use App\Modules\Moderation\Events\ReportModerated;
use App\Modules\Moderation\Events\ReportsMerged;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
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

        $event = $this->eventFor($dto->decision);

        $decision = $this->engine->evaluate($report, $event, $moderator);

        if (! $decision->allowed) {
            throw ApiException::validation(
                "Cannot {$dto->decision} report from state '{$report->currentStatus?->code}'.",
                ['decision' => $decision->reasons],
            );
        }

        $fromStatusId = $report->current_status_id;
        $fromCategoryId = $report->report_type_id ?? null;
        $fromDepartmentId = $report->department_id;

        $refreshed = DB::transaction(function () use ($report, $dto, $decision, $moderator, $fromStatusId, $fromCategoryId, $fromDepartmentId): Report {
            $this->applyCategoryOverride($report, $dto);
            $this->applyDepartmentOverride($report, $dto);

            $this->engine->apply($report, $decision, $moderator);

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
     */
    public function merge(string $canonicalId, array $duplicateIds, ?string $remarks, ?string $reasonCode, User $moderator): array
    {
        $this->assertCanModerate($moderator);

        $canonical = Report::query()->find($canonicalId);
        if ($canonical === null) {
            throw ApiException::validation("Canonical report '{$canonicalId}' not found.", ['canonical_id' => [$canonicalId]]);
        }

        $merged = DB::transaction(function () use ($canonical, $duplicateIds, $remarks, $reasonCode, $moderator): array {
            $merged = [];
            $mergedStatus = ReportStatus::query()->where('code', 'merged')->first();

            foreach (array_unique($duplicateIds) as $dupId) {
                if (! is_string($dupId) || $dupId === '' || $dupId === $canonical->id) {
                    continue;
                }
                $dup = Report::query()->find($dupId);
                if ($dup === null) {
                    continue;
                }
                $fromStatus = $dup->current_status_id;
                if ($mergedStatus !== null) {
                    $dup->current_status_id = $mergedStatus->id;
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
                    before: ['current_status_id' => $fromStatus],
                    after: ['current_status_id' => $dup->current_status_id, 'merged_into' => $canonical->id],
                    extra: [
                        'canonical_report_id' => $canonical->id,
                        'reason_code' => $reasonCode,
                    ],
                );
                $merged[] = $dup->id;
            }

            $this->writeAudit(
                $canonical,
                $moderator,
                action: 'report.canonical_for_merge',
                before: null,
                after: ['merged_duplicates' => $merged],
                extra: ['reason_code' => $reasonCode],
            );

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
            throw ApiException::validation('a report cannot be merged into itself.', ['merge_into_report_id' => [$report->id]]);
        }

        $this->merge($dto->mergeIntoReportId, [$report->id], $dto->remarks, $dto->reasonCode, $moderator);

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
