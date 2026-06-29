<?php

declare(strict_types=1);

namespace App\Modules\Reports\Events;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReportTypeUpdated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public readonly ReportType $reportType) {}
}
