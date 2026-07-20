<?php

declare(strict_types=1);

use App\Modules\Moderation\Http\Requests\StoreReviewRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

uses(TestCase::class);

/**
 * StoreReviewRequest is the input gate for the per-report
 * moderator action. It only enforces shape/type here — the
 * cross-field invariants live in ReviewReportDto — so these
 * tests pin the validation surface and the self-merge guard.
 */
it('exposes the four moderator decisions as the only allowed values', function (): void {
    $rules = (new StoreReviewRequest)->rules();

    expect($rules['decision'])->toBe(['nullable', 'string', 'in:approve,reject,merge,escalate'])
        ->and($rules['merge_into_report_id'])->toContain('uuid')
        ->and($rules['merge_into_report_id'])->toContain('different:report')
        ->and($rules['category_ids.*'])->toBe(['string', 'uuid']);
});

it('accepts a well-formed approve payload', function (): void {
    $validator = Validator::make(
        ['decision' => 'approve', 'remarks' => 'Verified on the ground.'],
        (new StoreReviewRequest)->rules(),
    );

    expect($validator->passes())->toBeTrue();
});

it('rejects a decision outside the allowed set', function (): void {
    $validator = Validator::make(
        ['decision' => 'archive'],
        (new StoreReviewRequest)->rules(),
    );

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('decision'))->toBeTrue();
});

it('rejects a non-uuid department id and over-long reason code', function (): void {
    $validator = Validator::make(
        [
            'decision' => 'approve',
            'department_id' => 'not-a-uuid',
            'reason_code' => str_repeat('x', 65),
        ],
        (new StoreReviewRequest)->rules(),
    );

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('department_id'))->toBeTrue()
        ->and($validator->errors()->has('reason_code'))->toBeTrue();
});

it('surfaces friendly messages for the decision and self-merge rules', function (): void {
    $messages = (new StoreReviewRequest)->messages();

    expect($messages['decision.in'])->toContain('approve, reject, merge, escalate')
        ->and($messages['merge_into_report_id.different'])->toContain('cannot be merged into itself');
});

it('authorizes only when a user is bound to the request', function (): void {
    $anon = new StoreReviewRequest;
    $anon->setUserResolver(fn () => null);

    $authed = new StoreReviewRequest;
    $authed->setUserResolver(fn () => new User);

    expect($anon->authorize())->toBeFalse()
        ->and($authed->authorize())->toBeTrue();
});
