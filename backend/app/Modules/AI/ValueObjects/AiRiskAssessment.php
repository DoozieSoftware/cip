<?php

declare(strict_types=1);

namespace App\Modules\AI\ValueObjects;

final readonly class AiRiskAssessment
{
    public function __construct(
        public int $duplicateScore,
        public int $fraudScore,
    ) {}
}
