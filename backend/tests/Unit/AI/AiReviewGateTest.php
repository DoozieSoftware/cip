<?php

declare(strict_types=1);

use App\Modules\AI\Services\AiReviewGate;
use App\Modules\AI\Services\ConfidenceAggregator;

function reviewGate(): AiReviewGate
{
    return new AiReviewGate(
        confidence: new ConfidenceAggregator(autoRouteMin: 95, moderatorReviewMin: 80),
        duplicateReviewMin: 60,
        misrepresentationReviewMin: 60,
        syntheticReviewMin: 50,
        locationReviewMin: 60,
    );
}

it('requires review for classification confidence below the auto-route threshold', function (): void {
    $reasons = reviewGate()->reasons(confidencePercent: 90);

    expect($reasons)->toBe([AiReviewGate::REASON_CLASSIFICATION_REVIEW]);
});

it('keeps high classification confidence separate from elevated risk signals', function (): void {
    $reasons = reviewGate()->reasons(
        confidencePercent: 98,
        duplicateScore: 100,
        fraudScore: 80,
    );

    expect($reasons)->toContain(AiReviewGate::REASON_DUPLICATE_RISK)
        ->and($reasons)->toContain(AiReviewGate::REASON_MISREPRESENTATION_RISK)
        ->and($reasons)->not->toContain(AiReviewGate::REASON_CLASSIFICATION_REVIEW);
});

it('allows auto-routing only when confidence and every risk gate are clear', function (): void {
    expect(reviewGate()->reasons(
        confidencePercent: 98,
        duplicateScore: 10,
        fraudScore: 20,
        claimMatchesEvidence: true,
        consistencyScore: 95,
        syntheticScore: 0.1,
        mockGpsScore: 0.1,
    ))->toBe([]);
});

it('gates unit-scale synthetic and location signals independently', function (): void {
    $reasons = reviewGate()->reasons(
        confidencePercent: 98,
        syntheticScore: 0.8,
        mockGpsScore: 0.7,
    );

    expect($reasons)->toContain(AiReviewGate::REASON_SYNTHETIC_MEDIA_RISK)
        ->and($reasons)->toContain(AiReviewGate::REASON_LOCATION_RISK);
});
