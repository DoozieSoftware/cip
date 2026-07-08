<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use App\Modules\Reports\Http\Resources\ReportResource;
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
 *   department).
 */
class DepartmentReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        $base = (new ReportResource($report))->resolve($request);

        $status = $report->relationLoaded('status') ? $report->status : $report->status()->first();
        $type = $report->relationLoaded('reportType') ? $report->reportType : $report->reportType()->first();
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();
        $notes = $report->relationLoaded('internalNotes')
            ? $report->internalNotes->map(fn ($n) => [
                'id' => $n->id,
                'body' => $n->body,
                'author_id' => $n->author_id,
                'author_name' => $n->relationLoaded('author') ? $n->author?->name : null,
                'created_at' => $n->created_at?->toIso8601String(),
            ])->all()
            : [];

        // array_merge, not `+` — the override array's `location` must win
        // over the base resource's differently-shaped one (latitude/
        // longitude vs the operations frontend's GeoPoint lat/lng).
        return array_merge($base, [
            'current_status_code' => $status?->code,
            'report_type' => $type === null ? null : ['id' => $type->id, 'code' => $type->code, 'name' => $type->name],
            'department_sla_minutes' => $report->department?->default_sla_minutes,
            'internal_notes' => $notes,
            'location' => $location === null ? null : [
                'lat' => (float) $location->latitude,
                'lng' => (float) $location->longitude,
                'accuracy' => $location->accuracy,
                'address' => $location->address,
            ],
        ]);
    }
}
