<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use Illuminate\Foundation\Events\Dispatchable;

final class TextileTripStarted
{
    use Dispatchable;

    public function __construct(public readonly TextileCollectionBatch $batch) {}
}
