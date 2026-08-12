<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use App\Modules\Reports\Http\Resources\ReportListResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lightweight operations-portal list row.
 *
 * Only touches relations the list query already eager-loads
 * (`reportType`, `department`, `status`, `priority`, `location`,
 * `activeAssignments.officer`, plus `media_count`). The full
 * `DepartmentReportResource` (with media, status history, the whole
 * assignment history and internal notes) is reserved for the detail
 * endpoint.
 *
 * The `location` key is overridden to the operations frontend's
 * GeoPoint shape (lat/lng), matching `DepartmentReportResource` so a
 * row keeps the same contract in both list and detail views.
 *
 * @property-read Report $resource
 */
class DepartmentReportListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        $base = (new ReportListResource($report))->toArray($request);

        $requestedDepartment = $request->query('department_id');
        $scopeDepartment = is_string($requestedDepartment) && $requestedDepartment !== ''
            ? $requestedDepartment
            : $report->department_id;

        $assignment = $report->activeAssignments
            ->when(
                is_string($scopeDepartment) && $scopeDepartment !== '',
                fn ($assignments) => $assignments->where('department_id', $scopeDepartment),
            )
            ->sortByDesc(fn (ReportAssignment $a) => $a->assigned_at)
            ->first();

        $location = $report->location;

        return array_merge($base, [
            'current_status_code' => $report->status?->code,
            'department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            'department_sla_minutes' => $report->department?->default_sla_minutes,
            'location' => $location === null ? null : [
                'lat' => (float) $location->latitude,
                'lng' => (float) $location->longitude,
                'accuracy' => $location->accuracy,
                'address' => $location->address,
            ],
            // The selected department's live task drives the SLA and status
            // pills in the list; the full assignment history stays on detail.
            'assignment' => $assignment === null ? null : [
                'id' => $assignment->id,
                'department_id' => $assignment->department_id,
                'is_primary' => (bool) $assignment->is_primary,
                'kind' => $assignment->kind,
                'status' => $assignment->task_status,
                'sla_minutes' => $assignment->sla_minutes,
                'assigned_at' => $assignment->assigned_at->toIso8601String(),
                'accepted_at' => $assignment->accepted_at?->toIso8601String(),
                'completed_at' => $assignment->completed_at?->toIso8601String(),
                'officer' => $assignment->officer === null ? null : [
                    'id' => $assignment->officer->id,
                    'name' => $assignment->officer->name,
                ],
            ],
            'internal_notes' => [],
        ]);
    }
}
