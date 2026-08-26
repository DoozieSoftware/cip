<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted by TextileCollectionOperationsService::recordOutcome() when the
 * outcome is `collected`. SendTextileCollectedNotification consumes this
 * to dispatch the `textile.collected` email to the requester's citizen.
 */
final class TextileCollectionCollected
{
    use Dispatchable;

    public function __construct(public readonly TextileCollectionRequest $collection) {}
}
