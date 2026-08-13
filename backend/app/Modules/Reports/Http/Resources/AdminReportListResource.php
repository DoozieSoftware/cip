<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Read-side row for the Super Admin cross-department report view.
 *
 * Extends `ReportListResource` with the assignment summary the
 * admin list needs. The full `ReportResource` fields (AI scores,
 * proof, audit trail) are intentionally omitted.
 *
 * @property-read Report $resource
 */
class AdminReportListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        $base = (new ReportListResource($report))->toArray($request);
        $assignments = $report->activeAssignments;

        return array_merge($base, [
            'current_status_code' => $report->status?->code,
            'department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            'assignments' => $assignments->map(static function (ReportAssignment $assignment): array {
                return [
                    'id' => $assignment->id,
                    'kind' => $assignment->kind,
                    'is_primary' => (bool) $assignment->is_primary,
                    'task_status' => $assignment->task_status,
                    'department' => $assignment->department === null ? null : [
                        'id' => $assignment->department->id,
                        'code' => $assignment->department->code,
                        'name' => $assignment->department->name,
                    ],
                    'officer' => $assignment->officer === null ? null : [
                        'id' => $assignment->officer->id,
                        'name' => $assignment->officer->name,
                    ],
                    'assigned_at' => $assignment->assigned_at->toIso8601String(),
                ];
            })->values()->all(),
        ]);
    }
}
