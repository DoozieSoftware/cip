<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted by TextileCollectionOperationsService::scheduleBatch() after a
 * batch has been persisted and its requests transitioned to scheduled.
 * SendTextileScheduledNotification consumes this and fans out one
 * `textile.scheduled` SMS per request in the batch.
 */
final class TextileCollectionScheduled
{
    use Dispatchable;

    public function __construct(public readonly TextileCollectionBatch $batch) {}
}
