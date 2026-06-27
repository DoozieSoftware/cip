<?php

declare(strict_types=1);

use App\Modules\AI\Services\FraudScorer;
use App\Modules\Reports\Models\Report;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('returns 0 when no security events are provided', function (): void {
    $report = Report::factory()->create();
    expect((new FraudScorer)->score($report, []))->toBe(0);
});

it('a mock-gps signal of 0.9 pushes the score above 75', function (): void {
    $report = Report::factory()->create();
    $score = (new FraudScorer)->score($report, ['mock_gps' => 0.9]);
    expect($score)->toBeGreaterThan(75)
        ->and((new FraudScorer)->shouldFlagForModerator($score))->toBeTrue();
});

it('combines weighted signals and clamps to 0..100', function (): void {
    $report = Report::factory()->create();

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

    // Mid: only mock_gps 0.5 → max(50, 0.5*0.40*100=20) = 50
    $mid = (new FraudScorer)->score($report, ['mock_gps' => 0.5]);
    expect($mid)->toBe(50);
});

it('does not flag for moderator when score is exactly at the threshold', function (): void {
    expect((new FraudScorer)->shouldFlagForModerator(75))->toBeFalse();
    expect((new FraudScorer)->shouldFlagForModerator(76))->toBeTrue();
});

it('exposes the FLAG_THRESHOLD constant of 75', function (): void {
    expect(FraudScorer::FLAG_THRESHOLD)->toBe(75);
});

it('ignores unknown signal keys without throwing', function (): void {
    $report = Report::factory()->create();
    $score = (new FraudScorer)->score($report, [
        'mock_gps' => 0.5,
        'future_signal' => 1.0, // unknown — must not affect score
    ]);
    expect($score)->toBe(50);
});
