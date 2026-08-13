<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Applies task-level changes without changing the report's global workflow. */
class DepartmentTaskService
{
    public function __construct(
        private readonly ProofVerificationService $proofVerification,
    ) {}

    public function complete(
        Report $report,
        ReportAssignment $assignment,
        User $actor,
        ?Request $request,
        ?string $note = null,
    ): Report {
        return DB::transaction(function () use ($report, $assignment, $actor, $request, $note): Report {
            $task = ReportAssignment::query()
                ->whereKey($assignment->getKey())
                ->where('report_id', $report->getKey())
                ->where('kind', ReportAssignment::KIND_SECONDARY)
                ->open()
                ->lockForUpdate()
                ->first();

            if ($task === null) {
                throw new ApiException(
                    'TASK_NOT_OPEN',
                    'Only an open secondary task can be completed.',
                    422,
                );
            }

            $this->proofVerification->assertAssignmentHasProof($report, $task);

            $task->update([
                'task_status' => ReportAssignment::TASK_STATUS_COMPLETED,
                'completed_at' => now(),
            ]);

            $requestId = $request?->attributes->get('trace_id');
            AuditLog::query()->create([
                'user_id' => $actor->getKey(),
                'entity' => 'reports',
                'entity_id' => $report->getKey(),
                'action' => 'report.secondary_task_completed',
                'before' => [
                    'assignment_id' => $task->getKey(),
                    'task_status' => ReportAssignment::TASK_STATUS_OPEN,
                ],
                'after' => [
                    'assignment_id' => $task->getKey(),
                    'department_id' => $task->department_id,
                    'kind' => ReportAssignment::KIND_SECONDARY,
                    'task_status' => ReportAssignment::TASK_STATUS_COMPLETED,
                    'completed_at' => $task->completed_at?->toIso8601String(),
                    'note' => $note,
                ],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);

            return $report->refresh()->load(['status', 'reportType', 'department', 'priority']);
        });
    }
}
