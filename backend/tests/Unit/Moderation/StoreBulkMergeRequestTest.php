<?php

declare(strict_types=1);

use App\Modules\Moderation\Http\Requests\StoreBulkMergeRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

uses(TestCase::class);

/**
 * StoreBulkMergeRequest gates the duplicate-fold endpoint. The
 * canonical report is the `{report}` route segment, so every id
 * in `duplicate_report_ids` must be a uuid that differs from it.
 */
it('requires at least one duplicate report id', function (): void {
    $rules = (new StoreBulkMergeRequest)->rules();

    expect($rules['duplicate_report_ids'])->toBe(['required', 'array', 'min:1'])
        ->and($rules['duplicate_report_ids.*'])->toBe(['string', 'uuid', 'different:report']);
});

it('accepts a valid list of duplicate uuids', function (): void {
    $validator = Validator::make(
        [
            'duplicate_report_ids' => [
                '019f0da4-0000-7000-8000-000000000001',
                '019f0da4-0000-7000-8000-000000000002',
            ],
            'reason_code' => 'duplicate',
        ],
        (new StoreBulkMergeRequest)->rules(),
    );

    expect($validator->passes())->toBeTrue();
});

it('fails when the duplicate list is missing or empty', function (): void {
    $missing = Validator::make([], (new StoreBulkMergeRequest)->rules());
    $empty = Validator::make(
        ['duplicate_report_ids' => []],
        (new StoreBulkMergeRequest)->rules(),
    );

    expect($missing->fails())->toBeTrue()
        ->and($empty->fails())->toBeTrue();
});

it('fails when a duplicate id is not a uuid', function (): void {
    $validator = Validator::make(
        ['duplicate_report_ids' => ['nope']],
        (new StoreBulkMergeRequest)->rules(),
    );

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('duplicate_report_ids.0'))->toBeTrue();
});

it('caps remarks at 2000 characters', function (): void {
    $validator = Validator::make(
        [
            'duplicate_report_ids' => ['019f0da4-0000-7000-8000-000000000001'],
            'remarks' => str_repeat('x', 2001),
        ],
        (new StoreBulkMergeRequest)->rules(),
    );

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('remarks'))->toBeTrue();
});

it('authorizes only an authenticated request', function (): void {
    $anon = new StoreBulkMergeRequest;
    $anon->setUserResolver(fn () => null);

    $authed = new StoreBulkMergeRequest;
    $authed->setUserResolver(fn () => new User);

    expect($anon->authorize())->toBeFalse()
        ->and($authed->authorize())->toBeTrue();
});
