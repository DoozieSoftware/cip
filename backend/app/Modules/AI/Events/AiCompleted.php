<?php

declare(strict_types=1);

namespace App\Modules\AI\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Dispatched by the M8 AI Vision Engine when a report's
 * media has been classified and labelled. The M7
 * `AiCompletedListener` consumes this event to:
 *  1. resolve the report against the active routing rules
 *  2. assign the report to the resolved department/officer
 *  3. transition the workflow either to `assigned` (when
 *     a routing decision was produced) or to
 *     `pending_moderator` (when no rule matched - Super
 *     Admin moderation is the safety net).
 *
 * Immutable; the listener does not need to re-load the
 * report to access the routing-relevant fields.
 */
final class AiCompleted
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $visionResult
     */
    public function __construct(
        public readonly string $reportId,
        public readonly ?string $categoryCode = null,
        public readonly ?string $severityCode = null,
        public readonly ?string $aiLabel = null,
        public readonly array $visionResult = [],
    ) {}
}
