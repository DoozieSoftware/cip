<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

/**
 * Maps the AI provider's overall confidence to a routing
 * decision per docs/10 §13.
 *
 *   confidence > 95  →  auto_route
 *                       the orchestrator trusts the
 *                       prediction enough to route
 *                       directly to the recommended
 *                       department (M7 routing rules
 *                       win)
 *   80 ≤ confidence ≤ 95  →  moderator_review
 *                       the AI's prediction is shown
 *                       to a moderator as a strong
 *                       recommendation, but a human
 *                       always has the final say
 *   confidence < 80  →  manual_classification
 *                       the AI's prediction is shown
 *                       only as a hint; the moderator
 *                       must classify from scratch
 *
 * Thresholds are config-driven via
 * `config('cip.ai.confidence.*')` with safe defaults
 * of 95 and 80.
 */
class ConfidenceAggregator
{
    public const DECISION_AUTO_ROUTE = 'auto_route';

    public const DECISION_MODERATOR_REVIEW = 'moderator_review';

    public const DECISION_MANUAL_CLASSIFICATION = 'manual_classification';

    public function decide(int|float $confidence): string
    {
        $auto = (int) config('cip.ai.confidence.auto_route_min', 95);
        $review = (int) config('cip.ai.confidence.moderator_review_min', 80);

        if ($confidence > $auto) {
            return self::DECISION_AUTO_ROUTE;
        }

        if ($confidence >= $review) {
            return self::DECISION_MODERATOR_REVIEW;
        }

        return self::DECISION_MANUAL_CLASSIFICATION;
    }
}
