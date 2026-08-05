<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\InternalNote;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * M11 — Operations-portal report resource.
 *
 * Extends the citizen / moderator ReportResource shape with
 * the per-department fields that the operations UI needs:
 * - `current_status_code` — flat status code (handy for the
 *   UI status pill, mirrors the M7 routing surface)
 * - the department's `default_sla_minutes` so the dashboard
 *   can flag SLA breaches
 * - the list of department-internal notes (private to the
 *   department)
 * - `media` — citizen evidence AND officer proof-of-completion
 *   photos (role-scoped), each with a time-limited signed URL
 * - `status_history` — the full lifecycle trail for the detail
 *   page timeline
 * - `assigned_to` — the currently-active field officer.
 *
 * @property-read Report $resource
 */
class DepartmentReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        // `resolve()` is annotated `@return array` by the framework, which
        // would leave array_merge() below with mixed keys; the base
        // resource's `toArray()` is the same payload here (no MergeValue /
        // when() branches to filter) and carries the string-key contract.
        $base = (new ReportResource($report))->toArray($request);

        $status = $report->relationLoaded('status') ? $report->status : $report->status()->first();
        $type = $report->relationLoaded('reportType') ? $report->reportType : $report->reportType()->first();
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();
        $requestedDepartment = $request->query('department_id');
        $assignmentDepartment = is_string($requestedDepartment) && $requestedDepartment !== ''
            ? $requestedDepartment
            : $report->department_id;
        $notes = $report->relationLoaded('internalNotes')
            ? $report->internalNotes
                ->where('department_id', $assignmentDepartment)
                ->map(fn (InternalNote $n): array => [
                    'id' => $n->id,
                    'body' => $n->body,
                    'author_id' => $n->author_id,
                    'author_name' => $n->relationLoaded('author') ? $n->author?->name : null,
                    'created_at' => $n->created_at?->toIso8601String(),
                ])->all()
            : [];

        $media = Media::query()
            ->where('report_id', $report->id)
            ->orderBy('created_at')
            ->get();
        $mediaUrl = new MediaUrl;

        $statusHistory = $report->relationLoaded('statusHistory')
            ? $report->statusHistory
            : $report->statusHistory()->with(['fromStatus', 'toStatus'])->orderBy('created_at')->get();

        $activeAssignment = ReportAssignment::query()
            ->where('report_id', $report->id)
            ->when(is_string($assignmentDepartment) && $assignmentDepartment !== '',
                fn ($query) => $query->where('department_id', $assignmentDepartment))
            ->whereIn('task_status', [
                ReportAssignment::TASK_STATUS_OPEN,
                ReportAssignment::TASK_STATUS_COMPLETED,
            ])
            ->whereNull('reassigned_at')
            ->with('officer')
            ->latest('assigned_at')
            ->first();

        $assignment = $activeAssignment === null ? null : [
            'id' => $activeAssignment->id,
            'department_id' => $activeAssignment->department_id,
            'is_primary' => (bool) $activeAssignment->is_primary,
            'kind' => $activeAssignment->kind,
            'status' => $activeAssignment->task_status,
            'sla_minutes' => $activeAssignment->sla_minutes,
            'assigned_at' => $activeAssignment->assigned_at->toIso8601String(),
            'accepted_at' => $activeAssignment->accepted_at?->toIso8601String(),
            'completed_at' => $activeAssignment->completed_at?->toIso8601String(),
            'officer' => $activeAssignment->officer === null ? null : [
                'id' => $activeAssignment->officer->id,
                'name' => $activeAssignment->officer->name,
            ],
        ];

        // array_merge, not `+` — the override array's `location` must win
        // over the base resource's differently-shaped one (latitude/
        // longitude vs the operations frontend's GeoPoint lat/lng).
        return array_merge($base, [
            'current_status_code' => $status?->code,
            'report_type' => $type === null ? null : ['id' => $type->id, 'code' => $type->code, 'name' => $type->name],
            'department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            'department_sla_minutes' => $report->department?->default_sla_minutes,
            'internal_notes' => $notes,
            'location' => $location === null ? null : [
                'lat' => (float) $location->latitude,
                'lng' => (float) $location->longitude,
                'accuracy' => $location->accuracy,
                'address' => $location->address,
            ],
            'media' => $media->map(fn (Media $m): array => [
                'id' => $m->id,
                'type' => $m->type,
                'role' => $m->role ?? 'evidence',
                'mime' => $m->mime,
                'url' => $mediaUrl->temporary($m),
                'width' => $m->width,
                'height' => $m->height,
                'created_at' => $m->created_at?->toIso8601String(),
            ])->all(),
            'status_history' => $statusHistory->map(fn (ReportStatusHistory $h): array => [
                'from_code' => $h->fromStatus?->code,
                'to_code' => $h->toStatus?->code,
                'actor_id' => $h->actor_id,
                'reason' => $h->reason,
                'created_at' => $h->created_at?->toIso8601String(),
            ])->all(),
            // The selected department's task is explicit so a support
            // queue never has to infer ownership from reports.department_id.
            'assignment' => $assignment,
            'assignments' => ReportAssignment::query()
                ->where('report_id', $report->id)
                ->whereNull('reassigned_at')
                ->with(['officer', 'department'])
                ->orderByDesc('is_primary')
                ->orderBy('assigned_at')
                ->get()
                ->map(fn (ReportAssignment $a): array => [
                    'id' => $a->id,
                    'department_id' => $a->department_id,
                    'department' => $a->department === null ? null : [
                        'id' => $a->department->id,
                        'code' => $a->department->code,
                        'name' => $a->department->name,
                    ],
                    'is_primary' => (bool) $a->is_primary,
                    'kind' => $a->kind,
                    'status' => $a->task_status,
                    'sla_minutes' => $a->sla_minutes,
                    'assigned_at' => $a->assigned_at->toIso8601String(),
                    'accepted_at' => $a->accepted_at?->toIso8601String(),
                    'completed_at' => $a->completed_at?->toIso8601String(),
                    'officer' => $a->officer === null ? null : [
                        'id' => $a->officer->id,
                        'name' => $a->officer->name,
                    ],
                ])->all(),
            'assigned_to' => $activeAssignment?->officer === null ? null : [
                'id' => $activeAssignment->officer->id,
                'name' => $activeAssignment->officer->name,
            ],
        ]);
    }
}
