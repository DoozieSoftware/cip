<?php

declare(strict_types=1);

use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Security\Services\SecurityPolicyService;
use App\Modules\Users\Models\User;
use Tests\TestCase;

uses(TestCase::class);

/**
 * UploadMediaRequest gates the multipart envelope for the photo
 * and video upload endpoints. The per-request caps are read from
 * SecurityPolicyService so a Super Admin can retune them without a
 * deploy; here that service is stubbed so the rule wiring is
 * exercised without hitting the database.
 */
beforeEach(function (): void {
    $policies = new class extends SecurityPolicyService
    {
        public function mediaMaxUploadMb(): int
        {
            return 16;
        }

        public function mediaMaxPhotosPerReport(): int
        {
            return 10;
        }

        public function mediaMaxVideoSeconds(): int
        {
            return 300;
        }
    };

    app()->instance(SecurityPolicyService::class, $policies);
});

it('builds photo rules with the configured count and size caps', function (): void {
    $rules = (new UploadMediaRequest)->rules();

    expect($rules)->toHaveKeys(['photos', 'photos.*'])
        ->and($rules['photos'])->toBe(['required', 'array', 'min:1', 'max:10'])
        ->and($rules['photos.*'])->toBe(['file', 'max:'.(16 * 1024)]);
});

it('switches to video rules via withField without mutating the original', function (): void {
    $request = new UploadMediaRequest;
    $videoRequest = $request->withField('video');

    expect($request->fieldName)->toBe('photos')
        ->and($videoRequest->fieldName)->toBe('video');

    $rules = $videoRequest->rules();

    expect($rules)->toHaveKeys(['video', 'duration_seconds'])
        ->and($rules)->not->toHaveKey('photos')
        ->and($rules['video'])->toBe(['required', 'file', 'max:'.(16 * 1024)])
        ->and($rules['duration_seconds'])->toBe(['nullable', 'integer', 'min:0', 'max:300']);
});

it('denies authorization when there is no authenticated user', function (): void {
    $request = new UploadMediaRequest;
    $request->setUserResolver(fn () => null);

    expect($request->authorize())->toBeFalse();
});

it('authorizes an authenticated user instance', function (): void {
    $request = new UploadMediaRequest;
    $request->setUserResolver(fn () => new User);

    expect($request->authorize())->toBeTrue();
});
