<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lightweight report row for list views (citizen list, staff list,
 * moderator queue). Only touches relations the list queries already
 * eager-loads (`reportType`, `status`, `priority`, `location`,
 * `department`, plus `media_count` via withCount).
 *
 * The full `ReportResource` (with AI fields, proof, audit trail,
 * status history) is reserved for detail endpoints.
 *
 * @property-read Report $resource
 */
class ReportListResource extends JsonResource
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
            'workflow_version' => $report->workflow_version,
            'title' => $report->title,
            'description' => $report->description,
            'is_anonymous' => (bool) $report->is_anonymous,
            'is_verified' => (bool) $report->is_verified,
            'ai_confidence' => $report->ai_confidence,
            'fraud_score' => $report->fraud_score,
            'duplicate_score' => $report->duplicate_score,
            'mock_gps_score' => $report->mock_gps_score,
            'report_type' => $report->reportType === null ? null : [
                'id' => $report->reportType->id,
                'code' => $report->reportType->code,
                'name' => $report->reportType->name,
            ],
            'status' => $report->status === null ? null : [
                'id' => $report->status->id,
                'code' => $report->status->code,
                'name' => $report->status->name,
                'is_terminal' => (bool) $report->status->is_terminal,
            ],
            'priority' => $report->priority === null ? null : [
                'id' => $report->priority->id,
                'code' => $report->priority->code,
                'name' => $report->priority->name,
                'sla_minutes' => $report->priority->sla_minutes,
            ],
            'department' => $report->department === null ? null : [
                'id' => $report->department->id,
                'code' => $report->department->code,
                'name' => $report->department->name,
            ],
            // @phpstan-ignore-next-line mixed cast
            'media_count' => (int) ($report->media_count ?? 0),
            'location' => $report->location === null ? null : [
                'id' => $report->location->id,
                'latitude' => $report->location->latitude,
                'longitude' => $report->location->longitude,
                'accuracy' => $report->location->accuracy,
                'address' => $report->location->address,
            ],
            'submitted_at' => $report->submitted_at?->toIso8601String(),
            'closed_at' => $report->closed_at?->toIso8601String(),
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
        ];
    }
}
