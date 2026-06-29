<?php

declare(strict_types=1);

namespace App\Modules\Reports\Events;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired after a Super Admin creates a new report type.
 * Subscribers include the audit log + cache invalidation.
 */
class ReportTypeCreated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public readonly ReportType $reportType) {}
}
