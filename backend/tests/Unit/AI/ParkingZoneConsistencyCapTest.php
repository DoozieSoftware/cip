<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Reports\Models\Report;
use Tests\TestCase;

uses(TestCase::class);

function parkingResponse(string $summary, int $consistency = 90): AiResponse
{
    return new AiResponse(
        labels: [['label' => 'illegal_parking', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'illegal_parking',
        confidence: 0.9,
        recommendedDepartment: 'BTP',
        severity: 'medium',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: $summary,
        claimMatchesEvidence: true,
        consistencyScore: $consistency,
    );
}

function capParking(AiResponse $response, string $title, string $description = ''): AiResponse
{
    $report = new Report;
    $report->title = $title;
    $report->description = $description;

    $orchestrator = new AiPipelineOrchestrator('00000000-0000-0000-0000-000000000000');
    $method = new ReflectionMethod($orchestrator, 'capUnverifiedParkingZoneClaim');

    /** @var AiResponse $result */
    $result = $method->invoke($orchestrator, $response, $report);

    return $result;
}

it('caps non-parking-zone claims when the legal restriction is not visible', function (): void {
    $result = capParking(
        parkingResponse('A white car is parked on the side of the road, partially blocking the sidewalk.'),
        'Vehicle parked in non-parking zone',
    );

    expect($result->consistencyScore)->toBe(80);
});

it('does not cap when a no-parking cue is visibly reported', function (): void {
    $result = capParking(
        parkingResponse('A white car is parked next to a visible no-parking sign.'),
        'Vehicle parked in non-parking zone',
    );

    expect($result->consistencyScore)->toBe(90);
});

it('does not cap generic obstruction claims without a legal-zone assertion', function (): void {
    $result = capParking(
        parkingResponse('A white car is parked on the side of the road, partially blocking the sidewalk.'),
        'Vehicle blocking the sidewalk',
    );

    expect($result->consistencyScore)->toBe(90);
});
