<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted by TextileCollectionOperationsService::recordOutcome() when
 * the outcome is `rejected`. SendTextileRejectionNotification consumes
 * this to dispatch the `textile.rejected` email to the requester.
 */
final class TextileCollectionRejected
{
    use Dispatchable;

    public function __construct(
        public readonly TextileCollectionRequest $collection,
        public readonly string $reason,
    ) {}
}
