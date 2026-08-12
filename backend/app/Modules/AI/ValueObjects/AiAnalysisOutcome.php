<?php

declare(strict_types=1);

namespace App\Modules\AI\ValueObjects;

final readonly class AiAnalysisOutcome
{
    public function __construct(
        public AiResponse $response,
        public int $qualityScore,
        public int $duplicateScore,
        public int $fraudScore,
        public float $confidence,
        public string $providerCode,
        public string $model,
    ) {}
}
