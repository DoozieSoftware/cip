<?php

declare(strict_types=1);

namespace App\Modules\Reports\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `AssignmentService::assign()` once a report
 * has been routed to a destination department (and, when
 * one is available, to a specific officer). Consumers:
 *  - Notifications (M9) - staff + citizen notifications
 *  - Audit log writer - records the routing decision
 *  - Analytics (M14)
 *
 * The event is immutable; all routing context required by
 * downstream consumers is captured in the constructor
 * so listeners do not need to re-resolve the report.
 */
final class ReportAssigned
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $reportId,
        public readonly string $departmentId,
        public readonly ?string $officerId,
        public readonly int $slaMinutes,
        public readonly ?string $actorId = null,
        public readonly ?string $reason = null,
        public readonly array $metadata = [],
    ) {}
}
