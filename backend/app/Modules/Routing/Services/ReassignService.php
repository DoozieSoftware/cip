<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Manual reassignment endpoint per docs/04 sec 12 and
 * docs/09 sec 13. The Super Admin (or moderator) uses
 * `POST /api/v1/admin/reports/{id}/reassign` to:
 *
 *   - mark the active `report_assignments` row with a
 *     non-null `reassigned_at`
 *   - insert a new active row with the new
 *     `(department, officer)` pair
 *   - mirror the new department + priority onto the
 *     `reports` row so list / search queries see the
 *     updated owner
 *   - dispatch `ReportAssigned` so notifications fire
 *   - write an `audit_logs` row keyed on the report
 */
class ReassignService
{
    public function reassign(
        Report $report,
        Department $department,
        ?User $officer,
        ReportPriority $priority,
        string $reason,
        ?User $actor,
        ?Request $request,
    ): ReportAssignment {
        return DB::transaction(function () use ($report, $department, $officer, $priority, $reason, $actor, $request): ReportAssignment {
            $previous = $report->assignments()
                ->whereNull('completed_at')
                ->whereNull('reassigned_at')
                ->orderByDesc('assigned_at')
                ->first();

            if ($previous !== null) {
                $previous->reassigned_at = now();
                $previous->reassignment_reason = $reason;
                $previous->save();
            }

            $assignment = ReportAssignment::query()->create([
                'report_id' => $report->id,
                'department_id' => $department->id,
                'officer_id' => $officer?->id,
                'assigned_by' => $actor?->id,
                'assigned_at' => now(),
                'accepted_at' => null,
                'completed_at' => null,
                'reassignment_reason' => null,
            ]);

            $report->department_id = $department->id;
            $report->priority_id = $priority->id;
            $report->save();

            $requestId = $request?->attributes->get('trace_id');

            AuditLog::query()->create([
                'user_id' => $actor?->id,
                'entity' => 'reports',
                'entity_id' => $report->id,
                'action' => 'report.reassign',
                'before' => $previous === null ? null : [
                    'department_id' => $previous->department_id,
                    'officer_id' => $previous->officer_id,
                ],
                'after' => [
                    'department_id' => $department->id,
                    'officer_id' => $officer?->id,
                    'priority_id' => $priority->id,
                ],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);

            ReportAssigned::dispatch(
                reportId: $report->id,
                departmentId: $department->id,
                officerId: $officer?->id,
                slaMinutes: 0,
                actorId: $actor?->id,
                reason: $reason,
            );

            return $assignment;
        });
    }

    public function resolvePriority(Report $report, ?string $priorityId): ReportPriority
    {
        if ($priorityId !== null) {
            $priority = ReportPriority::query()->find($priorityId);

            if ($priority !== null) {
                return $priority;
            }
        }

        if ($report->priority_id !== null) {
            $existing = ReportPriority::query()->find($report->priority_id);

            if ($existing !== null) {
                return $existing;
            }
        }

        $medium = ReportPriority::query()->where('code', 'medium')->first();

        if ($medium !== null) {
            return $medium;
        }

        throw ApiException::serverError('No ReportPriority rows exist; the database is unseeded.');
    }
}
