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

        $fromName = $row->fromStatus?->name;
        $toName = $row->toStatus?->name ?? 'updated';
        $event = $fromName !== null
            ? "Status changed from {$fromName} to {$toName}"
            : "Report {$toName}";

        // `reason` may carry an internal workflow-transition key
        // (e.g. "workflow.transition:<uuid>"); the real transition id
        // already lives in `metadata.transition_id`. Never surface the
        // machine key to users — only expose genuine human notes.
        $reason = $row->reason;
        $note = is_string($reason) && str_starts_with($reason, 'workflow.transition:')
            ? null
            : $reason;

        return [
            'id' => $row->id,
            'from_status_id' => $row->from_status_id,
            'to_status_id' => $row->to_status_id,
            'actor_id' => $row->actor_id,
            'actor' => $row->actor?->name ?? ($row->actor_id ? 'Official' : 'System'),
            'event' => $event,
            'note' => $note,
            'at' => $row->created_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'metadata' => $row->metadata,
        ];
    }
}
