<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Events;

use App\Modules\TextileCollections\Models\TextileDropoffReceipt;
use Illuminate\Foundation\Events\Dispatchable;

final class TextileDropoffReceiptRecorded
{
    use Dispatchable;

    public function __construct(public readonly TextileDropoffReceipt $receipt) {}
}
