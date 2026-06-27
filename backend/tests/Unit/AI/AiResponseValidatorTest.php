<?php

declare(strict_types=1);

use App\Modules\AI\Exceptions\InvalidAiResponseException;
use App\Modules\AI\Services\AiResponseValidator;
use App\Modules\AI\ValueObjects\AiResponse;

function validAiResponse(): AiResponse
{
    return new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 88,
        duplicateScore: 0,
        fraudScore: 2,
        summary: 'Pothole on MG Road.',
    );
}

it('accepts a well-formed AiResponse (passes validation)', function (): void {
    (new AiResponseValidator)->validate(validAiResponse());
    expect(true)->toBeTrue();
});

it('throws when labels is empty', function (): void {
    $r = new AiResponse(
        labels: [],
        predictedType: 'x',
        confidence: 0.5,
        recommendedDepartment: 'public_works',
        severity: 'low',
        qualityScore: 50,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'labels must be a non-empty array');
});

it('throws when a label has an empty label string', function (): void {
    $r = new AiResponse(
        labels: [['label' => '', 'confidence' => 0.5, 'is_primary' => true]],
        predictedType: 'x',
        confidence: 0.5,
        recommendedDepartment: 'public_works',
        severity: 'low',
        qualityScore: 50,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'label[0].label');
});

it('throws when label.confidence is out of [0, 1]', function (): void {
    $r = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 1.5, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'confidence must be in [0, 1]');
});

it('throws when no label is marked is_primary', function (): void {
    $r = new AiResponse(
        labels: [
            ['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => false],
            ['label' => 'road_damage', 'confidence' => 0.7, 'is_primary' => false],
        ],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'exactly 1 primary label');
});

it('throws when more than one label is marked is_primary', function (): void {
    $r = new AiResponse(
        labels: [
            ['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true],
            ['label' => 'road_damage', 'confidence' => 0.7, 'is_primary' => true],
        ],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'exactly 1 primary label');
});

it('throws when overall confidence is out of [0, 1]', function (): void {
    $r = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 1.5,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'overall confidence');
});

it('throws when severity is not in the allowed set', function (): void {
    $r = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'extreme', // not in {low, medium, high, critical}
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'severity must be one of');
});

it('throws when a 0..100 score is out of range', function (): void {
    $r = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 200, // out of range
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'qualityScore');
});

it('throws when summary is empty', function (): void {
    $r = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 80,
        duplicateScore: 0,
        fraudScore: 0,
        summary: '',
    );

    expect(fn () => (new AiResponseValidator)->validate($r))
        ->toThrow(InvalidAiResponseException::class, 'summary must be a non-empty string');
});

it('exception carries a context array for forensics', function (): void {
    $r = new AiResponse(
        labels: [],
        predictedType: 'x',
        confidence: 0.5,
        recommendedDepartment: 'public_works',
        severity: 'low',
        qualityScore: 50,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    try {
        (new AiResponseValidator)->validate($r);
        $this->fail('expected exception');
    } catch (InvalidAiResponseException $e) {
        expect($e->context)->toBe(['reason' => 'labels_empty']);
    }
});
