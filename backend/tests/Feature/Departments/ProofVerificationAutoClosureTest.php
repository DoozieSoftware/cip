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

it('allows automatic completion only for AI backed matching proof above 80 percent', function (): void {
    config()->set('cip.ai.proof_review.auto_close_min', 80);
    $service = proofVerificationServiceForAutoClosure();

    expect($service->eligibleForAutomaticClosure(proofVerificationForAutoClosure([
        'status' => 'match',
        'location_match' => true,
        'overall_confidence' => 81,
        'metadata' => ['engine' => 'proof_verification_ai_v1'],
    ])))->toBeTrue()
        ->and($service->eligibleForAutomaticClosure(proofVerificationForAutoClosure([
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 80,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ])))->toBeFalse()
        ->and($service->eligibleForAutomaticClosure(proofVerificationForAutoClosure([
            'status' => 'needs_review',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ])))->toBeFalse()
        ->and($service->eligibleForAutomaticClosure(proofVerificationForAutoClosure([
            'status' => 'match',
            'location_match' => false,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_verification_ai_v1'],
        ])))->toBeFalse()
        ->and($service->eligibleForAutomaticClosure(proofVerificationForAutoClosure([
            'status' => 'match',
            'location_match' => true,
            'overall_confidence' => 95,
            'metadata' => ['engine' => 'proof_validation_v1_fallback'],
        ])))->toBeFalse();
});
