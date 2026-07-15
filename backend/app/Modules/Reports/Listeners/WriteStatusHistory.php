<?php

declare(strict_types=1);

namespace App\Modules\Reports\Listeners;

use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\ReportStatusHistory;

/**
 * Persists every status transition to the append-only
 * `report_status_history` table. Wired in
 * `bootstrap/app.php` (`->withEvents(...)`).
 */
class WriteStatusHistory
{
    public function handle(ReportStatusChanged $event): void
    {
        // Guard against no-op transitions (from === to) which would
        // otherwise write a meaningless "X -> X" timeline row — e.g.
        // if a caller dispatches with the post-change status id.
        if ($event->fromStatusId !== null
            && $event->toStatusId !== null
            && $event->fromStatusId === $event->toStatusId) {
            return;
        }

        ReportStatusHistory::query()->create([
            'report_id' => $event->reportId,
            'from_status_id' => $event->fromStatusId,
            'to_status_id' => $event->toStatusId,
            'actor_id' => $event->actorId,
            'reason' => $event->reason,
            'metadata' => $event->metadata === [] ? null : $event->metadata,
            'created_at' => now(),
        ]);
    }
}
