<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Resolves and authorizes the assignment that owns an officer proof upload. */
class DepartmentProofAssignmentService
{
    public function resolve(
        Report $report,
        User $actor,
        ?string $requestedAssignmentId,
        ?string $requestedDepartmentId,
    ): ReportAssignment {
        $privileged = $actor->hasAnyRole(['super_admin', 'system']);

        if (! $privileged && ! DepartmentScope::isDepartmentScopedStaff($actor)) {
            throw ApiException::forbidden('Only an assigned department may attach completion proof.');
        }

        $memberDepartmentIds = $privileged
            ? []
            : DepartmentScope::memberDepartmentIds($actor);

        if (! $privileged && $memberDepartmentIds === []) {
            throw ApiException::forbidden('User is not a member of an assigned department.');
        }

        if (
            $requestedDepartmentId !== null
            && ! $privileged
            && ! in_array($requestedDepartmentId, $memberDepartmentIds, true)
        ) {
            throw ApiException::forbidden('You are not a member of the requested department.');
        }

        $base = ReportAssignment::query()
            ->where('report_id', $report->getKey())
            ->whereNull('reassigned_at')
            ->whereIn('task_status', [
                ReportAssignment::TASK_STATUS_OPEN,
                ReportAssignment::TASK_STATUS_COMPLETED,
            ]);

        if ($requestedAssignmentId !== null) {
            $assignment = (clone $base)->whereKey($requestedAssignmentId)->first();

            if ($assignment === null) {
                throw ApiException::validation(
                    'The selected assignment does not own this report.',
                    ['assignment_id' => ['Select a current assignment for this report.']],
                );
            }

            $this->assertDepartmentMatches(
                $assignment,
                $requestedDepartmentId,
                $memberDepartmentIds,
                $privileged,
            );

            return $assignment;
        }

        $candidates = $base
            ->when(
                $requestedDepartmentId !== null,
                fn (Builder $query): Builder => $query->where('department_id', $requestedDepartmentId),
            )
            ->when(
                ! $privileged && $requestedDepartmentId === null,
                fn (Builder $query): Builder => $query->whereIn('department_id', $memberDepartmentIds),
            )
            ->orderByDesc('is_primary')
            ->orderByDesc('assigned_at')
            ->get();

        if ($candidates->isEmpty()) {
            $fallbackDepartmentId = $requestedDepartmentId ?? $report->department_id;

            if (
                $fallbackDepartmentId !== null
                && ($privileged || in_array((string) $fallbackDepartmentId, $memberDepartmentIds, true))
            ) {
                return ReportAssignment::query()->firstOrCreate([
                    'report_id' => $report->getKey(),
                    'department_id' => (string) $fallbackDepartmentId,
                    'is_primary' => true,
                    'kind' => ReportAssignment::KIND_PRIMARY,
                    'reassigned_at' => null,
                    'task_status' => ReportAssignment::TASK_STATUS_OPEN,
                ], [
                    'officer_id' => null,
                    'assigned_by' => null,
                    'assigned_at' => $report->submitted_at ?? now(),
                    'accepted_at' => null,
                    'completed_at' => null,
                    'reassignment_reason' => null,
                    'sla_minutes' => $report->priority?->sla_minutes,
                ]);
            }

            throw ApiException::validation(
                'Completion proof must be attached to a current report assignment.',
                ['assignment_id' => ['No eligible assignment was found.']],
            );
        }

        if ($candidates->count() > 1) {
            throw new ApiException(
                'PROOF_ASSIGNMENT_AMBIGUOUS',
                'Select the assignment that owns this proof.',
                409,
                ['assignment_id' => ['More than one eligible assignment exists.']],
            );
        }

        /** @var ReportAssignment $assignment */
        $assignment = $candidates->first();

        return $assignment;
    }

    /** @param  list<string>  $memberDepartmentIds */
    private function assertDepartmentMatches(
        ReportAssignment $assignment,
        ?string $requestedDepartmentId,
        array $memberDepartmentIds,
        bool $privileged,
    ): void {
        if (
            $requestedDepartmentId !== null
            && (string) $assignment->department_id !== $requestedDepartmentId
        ) {
            throw ApiException::validation(
                'The selected assignment belongs to another department.',
                ['department_id' => ['Department and assignment must match.']],
            );
        }

        if (
            ! $privileged
            && ! in_array((string) $assignment->department_id, $memberDepartmentIds, true)
        ) {
            throw ApiException::forbidden('You cannot attach proof to another department assignment.');
        }
    }
}
