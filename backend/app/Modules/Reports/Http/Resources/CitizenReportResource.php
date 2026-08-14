<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Versioned citizen report detail resource — the v1 citizen API contract.
 *
 * Citizen-facing representation of a Report. Deliberately narrow: it
 * returns only the fields the citizen PWA consumes (matching
 * frontend/src/portals/citizen/types.ts ReportDetail) and omits internal
 * staff/admin signals (is_anonymous, is_verified, ai_confidence, raw
 * fraud/duplicate/mock_gps scores, citizen_id). The report type is
 * emitted as `type` (with its icon), not the generic `report_type`.
 *
 * @property-read Report $resource
 */
class CitizenReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $report = $this->resource;

        $location = $report->relationLoaded('location')
            ? $report->location
            : $report->location()->first();
        $type = $report->relationLoaded('reportType')
            ? $report->reportType
            : $report->reportType()->first();
        $status = $report->relationLoaded('status')
            ? $report->status
            : $report->status()->first();
        $priority = $report->relationLoaded('priority')
            ? $report->priority
            : $report->priority()->first();
        $department = $report->relationLoaded('department')
            ? $report->department
            : $report->department()->first();
        $mergedInto = $report->relationLoaded('canonicalReport')
            ? $report->canonicalReport
            : ($report->merged_into === null ? null : $report->canonicalReport()->first());
        $activeDispute = $report->activeMergeDispute();
        $proofPhotos = ($report->relationLoaded('media')
            ? $report->media
            : $report->media()->get())
            ->where('role', 'proof')
            ->where('is_replaced', false)
            ->values();
        $mediaUrl = app(MediaUrl::class);

        return [
            'id' => $report->id,
            'tracking_number' => $report->tracking_number,
            'workflow_version' => $report->workflow_version,
            'title' => $report->title,
            'description' => $report->description,
            'status' => $status === null ? null : [
                'code' => $status->code,
                'name' => $status->name,
                'is_terminal' => (bool) $status->is_terminal,
            ],
            'type' => $type === null ? null : [
                'code' => $type->code,
                'name' => $type->name,
                'icon' => $type->icon,
            ],
            'priority' => $priority === null ? null : [
                'code' => $priority->code,
                'name' => $priority->name,
            ],
            'assigned_department' => $department === null ? null : [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
            ],
            'department' => $department === null ? null : [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
            ],
            'location' => $location === null ? null : [
                'latitude' => $location->latitude,
                'longitude' => $location->longitude,
                'address' => $location->address,
            ],
            'media_count' => $report->relationLoaded('media')
                ? $report->media->where('is_replaced', false)->count()
                : Media::query()
                    ->where('report_id', $report->id)
                    ->where('is_replaced', false)
                    ->count(),
            'ai_summary' => $report->ai_label === null ? null : [
                'labels' => [[
                    'name' => $report->ai_label,
                    'confidence' => $report->ai_confidence === null
                        ? 0
                        : ($report->ai_confidence / 100),
                ]],
                'duplicate_of' => null,
                'recommended_department' => $department === null ? null : [
                    'name' => $department->name,
                    'code' => $department->code,
                ],
            ],
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
            'verification_deadline_at' => $report->verification_deadline_at?->toIso8601String(),
            'proof_photos' => $proofPhotos->map(fn (Media $media): array => [
                'id' => $media->id,
                'kind' => 'photo',
                'signed_url' => $mediaUrl->temporary($media),
            ])->all(),
            'merged_into' => $report->merged_into,
            'merged_at' => $report->merged_at?->toIso8601String(),
            'canonical_report' => $mergedInto === null ? null : [
                'id' => $mergedInto->id,
                'tracking_number' => $mergedInto->tracking_number,
                'title' => $mergedInto->title,
                'link' => '/citizen/reports/'.$mergedInto->id,
            ],
            'merge_dispute' => $activeDispute === null ? null : [
                'id' => $activeDispute->id,
                'status' => $activeDispute->status,
                'reason' => $activeDispute->reason,
            ],
        ];
    }
}
