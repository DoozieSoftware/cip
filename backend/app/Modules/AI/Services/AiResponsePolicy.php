<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Reports\Models\Report;

final class AiResponsePolicy
{
    public function disabled(): AiResponse
    {
        return new AiResponse(
            labels: [],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: 0,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'AI vision is disabled (app_configs.ai_enabled) — routed to moderator review.',
            raw: ['ai_disabled' => true],
        );
    }

    public function lowQuality(int $qualityScore): AiResponse
    {
        return new AiResponse(
            labels: [[
                'label' => 'unclassified',
                'confidence' => 0.0,
                'is_primary' => true,
            ]],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: $qualityScore,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'Evidence quality is too low for reliable visual classification; manual review is required.',
            raw: ['quality_gate' => true],
        );
    }

    public function videoReview(int $qualityScore): AiResponse
    {
        return new AiResponse(
            labels: [[
                'label' => 'unclassified',
                'confidence' => 0.0,
                'is_primary' => true,
            ]],
            predictedType: 'unclassified',
            confidence: 0.0,
            recommendedDepartment: '',
            severity: 'low',
            qualityScore: $qualityScore,
            duplicateScore: 0,
            fraudScore: 0,
            summary: 'Video evidence requires manual review because the configured vision provider accepts image inputs only.',
            raw: ['video_review' => true],
        );
    }

    public function normalizeClaimMatch(AiResponse $response): AiResponse
    {
        if ($response->consistencyScore !== null
            && $response->consistencyScore >= 70
            && $response->claimMatchesEvidence === false) {
            return $response->withClaimMatches(true);
        }

        return $response;
    }

    public function capUnverifiedParkingZoneClaim(AiResponse $response, Report $report): AiResponse
    {
        if ($response->predictedType !== 'illegal_parking') {
            return $response;
        }

        if ($response->consistencyScore === null || $response->consistencyScore <= 80) {
            return $response;
        }

        $claim = strtolower($report->title.' '.$report->description);

        if (! preg_match('/\b(?:no[-\s]?parking|non[-\s]?parking)\b/', $claim)) {
            return $response;
        }

        $evidence = strtolower($response->summary.' '.($response->mismatchReason ?? ''));

        if (preg_match('/\b(?:no[-\s]?parking|non[-\s]?parking|parking sign|road marking|signboard|tow[-\s]?away|parking restriction|restricted parking)\b/', $evidence)) {
            return $response;
        }

        return $response->withConsistencyScore(80);
    }

    public function effectiveQualityScore(int $localQualityScore, AiResponse $response): int
    {
        return $response->qualityScore > 0
            ? min($localQualityScore, $response->qualityScore)
            : $localQualityScore;
    }

    public function calibrateConfidence(float $confidence, AiResponse $response): float
    {
        if ($response->claimMatchesEvidence === false) {
            $factor = max(0.1, ($response->consistencyScore ?? 0) / 100);

            return $confidence * $factor;
        }

        if ($response->consistencyScore !== null && $response->consistencyScore < 50) {
            return $confidence * 0.5;
        }

        return $confidence;
    }
}
