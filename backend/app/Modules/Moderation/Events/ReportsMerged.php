<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `ModerationService::merge()` once one or more
 * duplicate reports have been folded into a canonical report.
 *
 * The canonical report's status moves to `merged` (which
 * behaves like `assigned` for routing purposes — the merged
 * duplicates share the canonical's department + officer).
 * The duplicate reports each get their own `merged` status
 * + a chain-of-custody row that points to the canonical.
 */
final class ReportsMerged
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  list<string>  $duplicateReportIds
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $canonicalReportId,
        public readonly array $duplicateReportIds,
        public readonly string $actorId,
        public readonly ?string $remarks = null,
        public readonly ?string $reasonCode = null,
        public readonly array $metadata = [],
    ) {}
}
