<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Foundation\Events\Dispatchable;

final class TextileCollectionRescheduled
{
    use Dispatchable;

    /**
     * @param array<string,mixed> $oldSchedule
     * @param array<string,mixed> $newSchedule
     */
    public function __construct(
        public readonly TextileCollectionRequest $collection,
        public readonly array $oldSchedule,
        public readonly array $newSchedule,
    ) {}
}
