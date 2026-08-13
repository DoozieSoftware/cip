<?php

declare(strict_types=1);

use App\Modules\Departments\Models\ReportProofVerification;
use App\Modules\Departments\Services\ProofVerificationService;

/** @param array<string, mixed> $attributes */
function proofVerificationForAutoClosure(array $attributes): ReportProofVerification
{
    return (new ReportProofVerification)->forceFill($attributes);
}

function proofVerificationServiceForAutoClosure(): ProofVerificationService
{
    /** @var ProofVerificationService $service */
    $service = (new ReflectionClass(ProofVerificationService::class))->newInstanceWithoutConstructor();

    return $service;
}

/** @param array<string, mixed> $attributes */
function autoClosureDecision(array $attributes): bool
{
    return proofVerificationServiceForAutoClosure()
        ->eligibleForAutomaticClosure(proofVerificationForAutoClosure($attributes));
}

it('allows automatic completion only above the configured threshold', function (): void {
    config()->set('cip.ai.proof_review.auto_close_min', 80);

    expect(autoClosureDecision([
        'status' => 'match',
        'location_match' => true,
        'overall_confidence' => 81,
        'metadata' => ['engine' => 'proof_verification_ai_v1'],
    ]))->toBeTrue()
        ->and(autoClosureDecision([
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 80,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ]))->toBeFalse()
        ->and(autoClosureDecision([
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 79,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ]))->toBeFalse();
});

it('blocks high confidence proof when any required signal is missing or unsafe', function (): void {
    config()->set('cip.ai.proof_review.auto_close_min', 80);

    $blockedCases = [
        'human review status' => [
            'status' => 'needs_review',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ],
        'mismatch status' => [
            'status' => 'mismatch',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ],
        'gps mismatch' => [
            'status' => 'match',
            'location_match' => false,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ],
        'gps unavailable' => [
            'status' => 'match',
            'location_match' => null,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ],
        'fallback engine' => [
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_validation_v1_fallback'],
        ],
        'missing engine metadata' => [
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => [],
        ],
        'non-array metadata' => [
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => null,
        ],
    ];

    foreach ($blockedCases as $case => $attributes) {
        expect(autoClosureDecision($attributes))->toBeFalse($case);
    }
});

it('honors configurable threshold values and clamps invalid configuration safely', function (): void {
    $validProof = [
        'status' => 'match',
        'location_match' => true,
        'metadata' => ['engine' => 'proof_verification_ai_v1'],
    ];

    config()->set('cip.ai.proof_review.auto_close_min', 90);
    expect(autoClosureDecision($validProof + ['overall_confidence' => 90]))->toBeFalse()
        ->and(autoClosureDecision($validProof + ['overall_confidence' => 91]))->toBeTrue();

    config()->set('cip.ai.proof_review.auto_close_min', 'not-a-number');
    expect(proofVerificationServiceForAutoClosure()->automaticClosureThreshold())->toBe(80)
        ->and(autoClosureDecision($validProof + ['overall_confidence' => 81]))->toBeTrue();

    config()->set('cip.ai.proof_review.auto_close_min', 150);
    expect(proofVerificationServiceForAutoClosure()->automaticClosureThreshold())->toBe(100)
        ->and(autoClosureDecision($validProof + ['overall_confidence' => 100]))->toBeFalse();

    config()->set('cip.ai.proof_review.auto_close_min', -10);
    expect(proofVerificationServiceForAutoClosure()->automaticClosureThreshold())->toBe(0)
        ->and(autoClosureDecision($validProof + ['overall_confidence' => 1]))->toBeTrue()
        ->and(autoClosureDecision($validProof + ['overall_confidence' => 0]))->toBeFalse();
});
