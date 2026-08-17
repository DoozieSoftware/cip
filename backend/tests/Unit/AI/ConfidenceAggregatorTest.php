<?php

declare(strict_types=1);

use App\Modules\AI\Services\ConfidenceAggregator;
use Tests\TestCase;

uses(TestCase::class);

it('confidence at or above 95 returns auto_route', function (): void {
    $agg = new ConfidenceAggregator;
    expect($agg->decide(94))->toBe('moderator_review')
        ->and($agg->decide(95))->toBe('auto_route')
        ->and($agg->decide(100))->toBe('auto_route');
});

it('confidence = 90 returns moderator_review', function (): void {
    $agg = new ConfidenceAggregator;
    expect($agg->decide(90))->toBe('moderator_review');
});

it('confidence in 80..94 returns moderator_review', function (): void {
    $agg = new ConfidenceAggregator;
    expect($agg->decide(80))->toBe('moderator_review')
        ->and($agg->decide(85))->toBe('moderator_review')
        ->and($agg->decide(94))->toBe('moderator_review');
});

it('confidence = 80 returns moderator_review (lower boundary inclusive)', function (): void {
    expect((new ConfidenceAggregator)->decide(80))->toBe('moderator_review');
});

it('confidence < 80 returns manual_classification', function (): void {
    $agg = new ConfidenceAggregator;
    expect($agg->decide(79))->toBe('manual_classification')
        ->and($agg->decide(50))->toBe('manual_classification')
        ->and($agg->decide(0))->toBe('manual_classification');
});

it('thresholds are config-driven and can be overridden at runtime', function (): void {
    config()->set('cip.ai.confidence.auto_route_min', 95);
    config()->set('cip.ai.confidence.moderator_review_min', 80);

    $agg = new ConfidenceAggregator;
    expect($agg->decide(95))->toBe('auto_route')
        ->and($agg->decide(94))->toBe('moderator_review')
        ->and($agg->decide(79))->toBe('manual_classification');
});

it('exposes the three decision constants', function (): void {
    expect(ConfidenceAggregator::DECISION_AUTO_ROUTE)->toBe('auto_route')
        ->and(ConfidenceAggregator::DECISION_MODERATOR_REVIEW)->toBe('moderator_review')
        ->and(ConfidenceAggregator::DECISION_MANUAL_CLASSIFICATION)->toBe('manual_classification');
});

it('accepts both int and float confidences', function (): void {
    $agg = new ConfidenceAggregator;
    expect($agg->decide(95.5))->toBe('auto_route')
        ->and($agg->decide(85.0))->toBe('moderator_review')
        ->and($agg->decide(50.5))->toBe('manual_classification');
});
