<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ReportResource — the API representation of a Report.
 * Per AGENTS.md ("Never return Models directly") and docs/03 §20.
 *
 * @property-read Report $resource
 */
class ReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;
        $location = $report->relationLoaded('location') ? $report->location : $report->location()->first();
        $type = $report->relationLoaded('reportType') ? $report->reportType : $report->reportType()->first();
        $status = $report->relationLoaded('status') ? $report->status : $report->status()->first();
        $priority = $report->relationLoaded('priority') ? $report->priority : $report->priority()->first();
        $citizen = $report->relationLoaded('citizen') ? $report->reportType : $report->citizen()->first();

        return [
            'id' => $report->id,
            'tracking_number' => $report->tracking_number,
            'title' => $report->title,
            'description' => $report->description,
            'is_anonymous' => (bool) $report->is_anonymous,
            'is_verified' => (bool) $report->is_verified,
            'ai_confidence' => $report->ai_confidence,
            'fraud_score' => $report->fraud_score,
            'duplicate_score' => $report->duplicate_score,
            'mock_gps_score' => $report->mock_gps_score,
            'citizen_id' => $report->is_anonymous ? null : $report->citizen_id,
            'report_type' => $type === null ? null : [
                'id' => $type->id,
                'code' => $type->code,
                'name' => $type->name,
            ],
            'status' => $status === null ? null : [
                'id' => $status->id,
                'code' => $status->code,
                'name' => $status->name,
                'is_terminal' => (bool) $status->is_terminal,
            ],
            'priority' => $priority === null ? null : [
                'id' => $priority->id,
                'code' => $priority->code,
                'name' => $priority->name,
                'sla_minutes' => $priority->sla_minutes,
            ],
            'location' => $location === null ? null : [
                'id' => $location->id,
                'latitude' => $location->latitude,
                'longitude' => $location->longitude,
                'accuracy' => $location->accuracy,
                'address' => $location->address,
                'captured_at' => $location->captured_at?->toIso8601String(),
            ],
            'submitted_at' => $report->submitted_at?->toIso8601String(),
            'closed_at' => $report->closed_at?->toIso8601String(),
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
        ];
    }
}
