<?php

declare(strict_types=1);

namespace App\Modules\AI\ValueObjects;

use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use Illuminate\Support\Collection;

final readonly class AiEvidenceBundle
{
    /**
     * @param  Collection<int, Media>  $media
     */
    public function __construct(
        public Report $report,
        public Collection $media,
        public string $revision,
    ) {}
}
