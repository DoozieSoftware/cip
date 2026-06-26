<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\ReportStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ReportStatusHistoryResource — the API representation of a single
 * status transition row. Used by the timeline endpoint.
 *
 * @property-read ReportStatusHistory $resource
 */
class ReportStatusHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $row = $this->resource;

        return [
            'id' => $row->id,
            'from_status_id' => $row->from_status_id,
            'to_status_id' => $row->to_status_id,
            'actor_id' => $row->actor_id,
            'reason' => $row->reason,
            'metadata' => $row->metadata,
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }
}
