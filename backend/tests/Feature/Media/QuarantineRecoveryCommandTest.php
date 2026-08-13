<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\RecoverQuarantinedMediaJob;
use App\Modules\Media\Models\MediaQuarantine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Schedule;

uses(RefreshDatabase::class);

it('dispatches a bounded quarantine recovery batch to the media queue', function (): void {
    Bus::fake([RecoverQuarantinedMediaJob::class]);
    $rows = MediaQuarantine::factory()->count(3)->create();

    $this->artisan('media:recover-quarantine', ['--limit' => 2])
        ->expectsOutput('2 quarantine recovery job(s) queued.')
        ->assertExitCode(0);

    Bus::assertDispatchedTimes(RecoverQuarantinedMediaJob::class, 2);
    Bus::assertDispatched(
        RecoverQuarantinedMediaJob::class,
        fn (RecoverQuarantinedMediaJob $job): bool => $rows->pluck('id')->contains($job->quarantineId),
    );
});

it('registers scanner recovery every ten minutes without overlap', function (): void {
    $event = collect(Schedule::events())->first(
        fn ($event): bool => ($event->description ?? null) === 'media:recover-quarantine',
    );

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('*/10 * * * *')
        ->and($event->withoutOverlapping)->toBeTrue();
});
