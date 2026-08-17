<?php

declare(strict_types=1);

use App\Modules\AI\Services\FraudScorer;
use App\Modules\Reports\Models\Report;

it('returns 0 when no security events are provided', function (): void {
    $report = new Report;
    expect((new FraudScorer)->score($report, []))->toBe(0);
});

it('applies the configured weight to a single mock-gps signal', function (): void {
    $report = new Report;
    $score = (new FraudScorer)->score($report, ['mock_gps' => 0.9]);
    expect($score)->toBe(36)
        ->and((new FraudScorer)->shouldFlagForModerator($score))->toBeFalse();
});

it('combines weighted signals and clamps to 0..100', function (): void {
    $report = new Report;

    // All signals at 1.0 → weight sum = 1.00 → 100
    $max = (new FraudScorer)->score($report, [
        'mock_gps' => 1.0,
        'replay' => 1.0,
        'ai_synth' => 1.0,
        'repeated_device' => 1.0,
        'rate_limit' => 1.0,
    ]);
    expect($max)->toBe(100);

    // All zeros → 0
    $min = (new FraudScorer)->score($report, [
        'mock_gps' => 0.0,
        'replay' => 0.0,
        'ai_synth' => 0.0,
        'repeated_device' => 0.0,
        'rate_limit' => 0.0,
    ]);
    expect($min)->toBe(0);

    // Mid: only mock_gps 0.5 → 0.5*0.40*100 = 20
    $mid = (new FraudScorer)->score($report, ['mock_gps' => 0.5]);
    expect($mid)->toBe(20);
});

it('does not mirror a duplicate score as independent misrepresentation risk', function (): void {
    $report = new Report;

    expect((new FraudScorer)->score($report, ['replay' => 1.0]))->toBe(25);
});

it('does not flag for moderator when score is exactly at the threshold', function (): void {
    expect((new FraudScorer)->shouldFlagForModerator(75))->toBeFalse();
    expect((new FraudScorer)->shouldFlagForModerator(76))->toBeTrue();
});

it('exposes the FLAG_THRESHOLD constant of 75', function (): void {
    expect(FraudScorer::FLAG_THRESHOLD)->toBe(75);
});

it('ignores unknown signal keys without throwing', function (): void {
    $report = new Report;
    $score = (new FraudScorer)->score($report, [
        'mock_gps' => 0.5,
        'future_signal' => 1.0, // unknown — must not affect score
    ]);
    expect($score)->toBe(20);
});
