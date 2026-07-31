<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\ValueObjects\AiResponse;
use Tests\TestCase;

uses(TestCase::class);

function penaltyFor(AiResponse $response): float
{
    $orchestrator = new AiPipelineOrchestrator('00000000-0000-0000-0000-000000000000');
    $method = new ReflectionMethod($orchestrator, 'applyMismatchPenalty');

    /** @var float $result */
    $result = $method->invoke($orchestrator, 0.90, $response);

    return $result;
}

function makeResponse(
    ?bool $claimMatches = null,
    ?int $consistencyScore = null,
): AiResponse {
    return new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.92, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.92,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 88,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'test',
        claimMatchesEvidence: $claimMatches,
        consistencyScore: $consistencyScore,
    );
}

it('does not penalise when claim matches evidence', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: true, consistencyScore: 90)))
        ->toBe(0.90);
});

it('does not penalise when claim-match signals are absent', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: null, consistencyScore: null)))
        ->toBe(0.90);
});

it('scales the penalty by consistency when claim does not match (consistency 30)', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: false, consistencyScore: 30)))
        ->toEqualWithDelta(0.27, 0.001);
});

it('scales the penalty by consistency when claim does not match (consistency 65)', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: false, consistencyScore: 65)))
        ->toEqualWithDelta(0.585, 0.001);
});

it('collapses confidence toward the floor on a total mismatch (consistency 0)', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: false, consistencyScore: 0)))
        ->toEqualWithDelta(0.09, 0.001);
});

it('uses the 0.1 floor when claim mismatches but consistency is missing', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: false, consistencyScore: null)))
        ->toEqualWithDelta(0.09, 0.001);
});

it('applies moderate penalty when consistency is below 50 without explicit mismatch', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: null, consistencyScore: 40)))
        ->toEqualWithDelta(0.45, 0.001);
});

it('does not penalise when consistency is 50 or above without mismatch', function (): void {
    expect(penaltyFor(makeResponse(claimMatches: null, consistencyScore: 50)))
        ->toBe(0.90);
    expect(penaltyFor(makeResponse(claimMatches: null, consistencyScore: 80)))
        ->toBe(0.90);
});

it('claim mismatch branch wins over the consistency-only branch', function (): void {
    $result = penaltyFor(makeResponse(claimMatches: false, consistencyScore: 40));
    expect($result)->toEqualWithDelta(0.36, 0.001);
});
