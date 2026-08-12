<?php

declare(strict_types=1);

namespace App\Modules\Reports\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Raised exactly once for a finalized evidence revision. Consumers may
 * safely retry because the revision is the idempotency boundary.
 */
final class ReportEvidenceReady
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  list<string>  $mediaIds
     */
    public function __construct(
        public readonly string $reportId,
        public readonly string $revision,
        public readonly array $mediaIds,
    ) {}
}
