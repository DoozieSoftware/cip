<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

/**
 * Produces the human-review reasons shared by workflow routing and the
 * moderator UI. Classification confidence stays independent from security
 * risk; any configured risk gate can still prevent automatic assignment.
 */
final class AiReviewGate
{
    public const REASON_CLASSIFICATION_REVIEW = 'classification_review';

    public const REASON_MANUAL_CLASSIFICATION = 'manual_classification';

    public const REASON_EVIDENCE_MISMATCH = 'evidence_mismatch';

    public const REASON_DUPLICATE_RISK = 'duplicate_risk';

    public const REASON_MISREPRESENTATION_RISK = 'misrepresentation_risk';

    public const REASON_SYNTHETIC_MEDIA_RISK = 'synthetic_media_risk';

    public const REASON_LOCATION_RISK = 'location_risk';

    public function __construct(
        private readonly ConfidenceAggregator $confidence,
        private readonly ?int $duplicateReviewMin = null,
        private readonly ?int $misrepresentationReviewMin = null,
        private readonly ?int $syntheticReviewMin = null,
        private readonly ?int $locationReviewMin = null,
    ) {}

    /**
     * @return list<string>
     */
    public function reasons(
        int|float $confidencePercent,
        int|float|null $duplicateScore = null,
        int|float|null $fraudScore = null,
        ?bool $claimMatchesEvidence = null,
        int|float|null $consistencyScore = null,
        int|float|null $syntheticScore = null,
        int|float|null $mockGpsScore = null,
    ): array {
        $reasons = [];
        $classificationDecision = $this->confidence->decide($confidencePercent);

        if ($classificationDecision === ConfidenceAggregator::DECISION_MODERATOR_REVIEW) {
            $reasons[] = self::REASON_CLASSIFICATION_REVIEW;
        } elseif ($classificationDecision === ConfidenceAggregator::DECISION_MANUAL_CLASSIFICATION) {
            $reasons[] = self::REASON_MANUAL_CLASSIFICATION;
        }

        $lowConsistency = is_numeric($consistencyScore) && (float) $consistencyScore < 50.0;

        if ($claimMatchesEvidence === false || $lowConsistency) {
            $reasons[] = self::REASON_EVIDENCE_MISMATCH;
        }

        if ($this->atOrAbove($duplicateScore, 'duplicate_review_min', 60)) {
            $reasons[] = self::REASON_DUPLICATE_RISK;
        }

        if ($this->atOrAbove($fraudScore, 'misrepresentation_review_min', 60)) {
            $reasons[] = self::REASON_MISREPRESENTATION_RISK;
        }

        if ($this->unitScoreAtOrAbove($syntheticScore, 'synthetic_review_min', 50)) {
            $reasons[] = self::REASON_SYNTHETIC_MEDIA_RISK;
        }

        if ($this->unitScoreAtOrAbove($mockGpsScore, 'location_review_min', 60)) {
            $reasons[] = self::REASON_LOCATION_RISK;
        }

        return $reasons;
    }

    private function atOrAbove(int|float|null $score, string $configKey, int $default): bool
    {
        if (! is_numeric($score)) {
            return false;
        }

        return (float) $score >= $this->threshold($configKey, $default);
    }

    private function unitScoreAtOrAbove(int|float|null $score, string $configKey, int $default): bool
    {
        if (! is_numeric($score)) {
            return false;
        }

        $percent = max(0.0, min(1.0, (float) $score)) * 100;

        return $percent >= $this->threshold($configKey, $default);
    }

    private function threshold(string $key, int $default): int
    {
        $override = match ($key) {
            'duplicate_review_min' => $this->duplicateReviewMin,
            'misrepresentation_review_min' => $this->misrepresentationReviewMin,
            'synthetic_review_min' => $this->syntheticReviewMin,
            'location_review_min' => $this->locationReviewMin,
            default => null,
        };
        $configured = $override ?? config('cip.ai.risk.'.$key, $default);
        $threshold = is_numeric($configured) ? (int) $configured : $default;

        return max(0, min(100, $threshold));
    }
}
