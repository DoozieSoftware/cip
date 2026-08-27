<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted by TextileCollectionService::create() after a new standalone
 * textile collection request has been persisted in pending_review.
 * SendTextileAcknowledgmentOnCollection consumes this to dispatch the
 * `textile.acknowledged` notification to the requester's citizen user.
 */
final class TextileCollectionAcknowledged
{
    use Dispatchable;

    public function __construct(public readonly TextileCollectionRequest $collection) {}
}
