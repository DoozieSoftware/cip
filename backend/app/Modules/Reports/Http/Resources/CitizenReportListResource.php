<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lightweight citizen list row — the v1 citizen list contract.
 *
 * Mirrors the field subset of `CitizenReportResource` that the citizen
 * PWA list views (`MyReportsPage`, `HomePage`) actually read, but only
 * touches relations the list query already eager-loads (`reportType`,
 * `status`, `priority`, `location`, `department`) plus the
 * `media_count` aggregate from `withCount('media')`.
 *
 * The detail resource is deliberately not reused here: it resolves
 * `media_count` with a per-row `Media` count query and calls
 * `activeMergeDispute()`, which lazy-loads `mergeDisputes` per row.
 * On a 100-row page that is 200 extra queries.
 *
 * @property-read Report $resource
 */
class CitizenReportListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;

        return [
            'id' => $report->id,
            'tracking_number' => $report->tracking_number,
            'title' => $report->title,
            'description' => $report->description,
            'status' => $report->status === null ? null : [
                'code' => $report->status->code,
                'name' => $report->status->name,
                'is_terminal' => (bool) $report->status->is_terminal,
            ],
            'type' => $report->reportType === null ? null : [
                'code' => $report->reportType->code,
                'name' => $report->reportType->name,
                'icon' => $report->reportType->icon,
            ],
            'priority' => $report->priority === null ? null : [
                'code' => $report->priority->code,
                'name' => $report->priority->name,
            ],
            'assigned_department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            'department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            'location' => $report->location === null ? null : [
                'latitude' => $report->location->latitude,
                'longitude' => $report->location->longitude,
                'address' => $report->location->address,
            ],
            // @phpstan-ignore-next-line withCount aggregate is mixed
            'media_count' => (int) ($report->media_count ?? 0),
            // `merged_into` is a plain column, so the merge banner still
            // renders in the list. The canonical report and the active
            // dispute need extra rows and stay on the detail endpoint.
            'merged_into' => $report->merged_into,
            'merged_at' => $report->merged_at?->toIso8601String(),
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
        ];
    }
}
