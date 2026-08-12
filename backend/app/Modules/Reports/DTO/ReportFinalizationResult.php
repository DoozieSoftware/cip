<?php

declare(strict_types=1);

namespace App\Modules\Reports\DTO;

use App\Modules\Reports\Models\Report;

final readonly class ReportFinalizationResult
{
    public function __construct(
        public Report $report,
        public bool $alreadySubmitted,
    ) {}
}
