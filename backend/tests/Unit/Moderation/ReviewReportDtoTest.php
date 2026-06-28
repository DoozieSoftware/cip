<?php

declare(strict_types=1);

use App\Modules\Moderation\DTO\ReviewReportDto;
use App\Modules\Shared\Exceptions\ApiException;

/**
 * The DTO is the single contract between the Form Request and
 * the ModerationService. The tests guard the wire-shape contract
 * (per docs/14 §10) and ensure missing / invalid fields raise
 * a 422 ApiException, not a 500.
 */
it('builds a minimal approve DTO from a valid payload', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'remarks' => 'Looks good — verified on the ground.',
    ]);

    expect($dto->decision)->toBe('approve')
        ->and($dto->remarks)->toBe('Looks good — verified on the ground.')
        ->and($dto->overrideAi)->toBeFalse()
        ->and($dto->acceptedAi())->toBeTrue()
        ->and($dto->mergeIntoReportId)->toBeNull()
        ->and($dto->reasonCode)->toBeNull();
});

it('builds a reject DTO with a reason code and remarks', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'reject',
        'reason_code' => 'duplicate',
        'remarks' => 'Marked duplicate of CIV-2026-000123.',
    ]);

    expect($dto->decision)->toBe('reject')
        ->and($dto->reasonCode)->toBe('duplicate')
        ->and($dto->remarks)->toBe('Marked duplicate of CIV-2026-000123.');
});

it('builds a merge DTO with the canonical report id', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'merge',
        'merge_into_report_id' => '019f0da4-0000-7000-8000-000000000001',
        'remarks' => 'Merged into the canonical pothole report.',
    ]);

    expect($dto->decision)->toBe('merge')
        ->and($dto->mergeIntoReportId)->toBe('019f0da4-0000-7000-8000-000000000001');
});

it('builds an escalate DTO with override_ai = true', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'escalate',
        'override_ai' => true,
        'reason_code' => 'high_fraud_score',
        'remarks' => 'AI fraud score 0.91 — needs senior review.',
    ]);

    expect($dto->decision)->toBe('escalate')
        ->and($dto->overrideAi)->toBeTrue()
        ->and($dto->acceptedAi())->toBeFalse()
        ->and($dto->reasonCode)->toBe('high_fraud_score');
});

it('builds a DTO with category + department overrides', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'department_id' => '019f0da4-0000-7000-8000-0000000000a1',
        'category_id' => '019f0da4-0000-7000-8000-0000000000b2',
        'category_ids' => [
            '019f0da4-0000-7000-8000-0000000000b3',
            '019f0da4-0000-7000-8000-0000000000b4',
        ],
    ]);

    expect($dto->departmentId)->toBe('019f0da4-0000-7000-8000-0000000000a1')
        ->and($dto->categoryId)->toBe('019f0da4-0000-7000-8000-0000000000b2')
        ->and($dto->categoryIds)->toContain('019f0da4-0000-7000-8000-0000000000b2')
        ->and($dto->categoryIds)->toContain('019f0da4-0000-7000-8000-0000000000b3')
        ->and($dto->categoryIds)->toContain('019f0da4-0000-7000-8000-0000000000b4');
});

it('throws 422 ApiException on an unknown decision', function (): void {
    ReviewReportDto::fromArray([
        'decision' => 'archive',
    ]);
})->throws(ApiException::class);

it('throws 422 ApiException when decision is missing', function (): void {
    ReviewReportDto::fromArray([
        'remarks' => 'no decision supplied',
    ]);
})->throws(ApiException::class);

it('truncates remarks at 2000 characters', function (): void {
    $remarks = str_repeat('x', 2500);
    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'remarks' => $remarks,
    ]);

    expect($dto->remarks)->toHaveLength(2000);
});

it('drops empty / non-string reason_code and merge_into_report_id', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'merge',
        'merge_into_report_id' => '',
        'reason_code' => null,
    ]);

    expect($dto->mergeIntoReportId)->toBeNull()
        ->and($dto->reasonCode)->toBeNull();
});

it('coerces non-string category_ids to strings and filters empties', function (): void {
    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'category_ids' => ['abc', 42, '', null, 0],
    ]);

    expect($dto->categoryIds)->toBe(['abc', '42', '0']);
});

it('acceptedAi() mirrors overrideAi', function (): void {
    $on = ReviewReportDto::fromArray(['decision' => 'approve', 'override_ai' => true]);
    $off = ReviewReportDto::fromArray(['decision' => 'approve']);

    expect($on->acceptedAi())->toBeFalse()
        ->and($off->acceptedAi())->toBeTrue();
});
