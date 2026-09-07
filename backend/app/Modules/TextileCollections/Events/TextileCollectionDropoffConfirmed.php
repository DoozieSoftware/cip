<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Foundation\Events\Dispatchable;

final class TextileCollectionDropoffConfirmed
{
    use Dispatchable;

    public function __construct(public readonly TextileCollectionRequest $collection) {}
}
