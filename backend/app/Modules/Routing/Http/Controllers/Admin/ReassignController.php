<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Controllers\Admin;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Routing\Http\Requests\ReassignReportRequest;
use App\Modules\Routing\Services\ReassignService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Manual reassignment endpoint per docs/04 sec 12.
 *
 *  - POST /api/v1/admin/reports/{id}/reassign
 *
 * Body:
 *   { "department_id": "<uuid>", "officer_id": "<uuid>"?, "priority_id": "<uuid>"?, "reason": "<text>" }
 *
 * The active assignment row gets `reassigned_at` set; a
 * fresh active row is inserted; the report's
 * `department_id` / `priority_id` are mirrored; the
 * `ReportAssigned` event fires for notifications; an
 * `audit_logs` row is written.
 */
class ReassignController extends BaseController
{
    public function __construct(
        private readonly ReassignService $service,
    ) {}

    public function __invoke(ReassignReportRequest $request, string $report): JsonResponse
    {
        $reportModel = Report::query()->find($report);

        if ($reportModel === null) {
            throw ApiException::notFound('Report');
        }

        $department = Department::query()->find($request->string('department_id')->toString());

        if ($department === null) {
            throw ApiException::notFound('Department');
        }

        $officerId = $request->input('officer_id');
        $officer = $officerId !== null ? User::query()->find($officerId) : null;

        if ($officerId !== null && $officer === null) {
            throw ApiException::notFound('Officer');
        }

        $priority = $this->service->resolvePriority(
            $reportModel,
            $request->input('priority_id') !== null
                ? (string) $request->input('priority_id')
                : null,
        );

        $assignment = $this->service->reassign(
            report: $reportModel,
            department: $department,
            officer: $officer,
            priority: $priority,
            reason: (string) $request->input('reason'),
            actor: $request->user(),
            request: $request,
        );

        return $this->respond(
            [
                'id' => $assignment->id,
                'report_id' => $assignment->report_id,
                'department_id' => $assignment->department_id,
                'officer_id' => $assignment->officer_id,
                'assigned_by' => $assignment->assigned_by,
                'assigned_at' => $assignment->assigned_at?->toIso8601String(),
                'reassignment_reason' => $assignment->reassignment_reason,
            ],
            'Report reassigned.',
        );
    }
}
