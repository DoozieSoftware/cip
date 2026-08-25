<?php

declare(strict_types=1);

use App\Modules\Departments\Jobs\VerifyProofJob;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Tests\TestCase;

uses(TestCase::class);
it('queues proof verification with bounded retries and one job per media item', function (): void {
    $job = new VerifyProofJob('proof-media-id');

    expect($job)->toBeInstanceOf(ShouldQueue::class)
        ->and($job)->toBeInstanceOf(ShouldBeUnique::class)
        ->and($job->mediaId)->toBe('proof-media-id')
        ->and($job->tries)->toBe(3)
        ->and($job->backoff)->toBe([15, 60, 180])
        ->and($job->timeout)->toBe(120)
        ->and($job->uniqueId())->toBe('proof-media-id')
        ->and($job->uniqueFor())->toBe(900)
        ->and($job->tags())->toBe([
            'departments',
            'proof-verification',
            'media:proof-media-id',
        ]);
});
