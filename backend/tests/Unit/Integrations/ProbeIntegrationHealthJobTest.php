<?php

declare(strict_types=1);

use App\Modules\Integrations\Jobs\ProbeIntegrationHealthJob;
use Tests\TestCase;

uses(TestCase::class);
it('has bounded retry and uniqueness settings for asynchronous probes', function (): void {
    $job = new ProbeIntegrationHealthJob('integration-id', 'requesting-user-id');

    expect($job->queue)->toBe('default')
        ->and($job->uniqueId())->toBe('integration-id')
        ->and($job->tries)->toBe(3)
        ->and($job->timeout)->toBe(15)
        ->and($job->backoff)->toBe([60, 300])
        ->and($job->uniqueFor)->toBe(60);
});
