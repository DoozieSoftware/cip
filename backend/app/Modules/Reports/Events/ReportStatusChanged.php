<?php

declare(strict_types=1);

namespace App\Modules\Reports\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `ReportService::transitionTo()` after a report
 * moves from one status to the next. The WriteStatusHistory
 * listener is the only mandatory consumer (it appends a
 * `report_status_history` row); the Notifications module
 * (M9) and the Workflow engine (M6) subscribe downstream.
 */
final class ReportStatusChanged
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $reportId,
        public readonly ?string $fromStatusId,
        public readonly string $toStatusId,
        public readonly ?string $actorId = null,
        public readonly ?string $reason = null,
        public readonly array $metadata = [],
    ) {}
}
