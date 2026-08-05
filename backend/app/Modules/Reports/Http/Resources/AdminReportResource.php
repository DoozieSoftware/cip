<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lightweight report row for the read-only Super Admin cross-department view.
 */
class AdminReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Report $report */
        $report = $this->resource;
        $base = (new ReportResource($report))->toArray($request);
        $assignments = $report->relationLoaded('assignments')
            ? $report->assignments
            : $report->assignments()
                ->whereNull('reassigned_at')
                ->whereNull('completed_at')
                ->where('task_status', '!=', ReportAssignment::TASK_STATUS_CANCELLED)
                ->with(['department', 'officer'])
                ->get();
        $assignments = $assignments->filter(static fn (ReportAssignment $assignment): bool => $assignment->reassigned_at === null
            && $assignment->completed_at === null
            && $assignment->task_status !== ReportAssignment::TASK_STATUS_CANCELLED);

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
