<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Workflow\Jobs\CheckSlaBreaches;

it('media jobs target the media queue', function (): void {
    expect((new ComputeHashesJob('media-uuid'))->queue)->toBe('media');
    expect((new GenerateThumbnailJob('media-uuid'))->queue)->toBe('media');
    expect((new ExtractVideoMetadataJob('media-uuid'))->queue)->toBe('media');
});

it('ai job targets the ai queue', function (): void {
    expect((new AiPipelineOrchestrator('report-uuid'))->queue)->toBe('ai');
});

it('notification job targets the notifications queue', function (): void {
    expect((new SendNotificationJob('notification-uuid'))->queue)->toBe('notifications');
});

it('sla breach job has no explicit queue and falls back to default at dispatch', function (): void {
    expect((new CheckSlaBreaches)->queue)->toBeNull();
});

it('retry_after exceeds the longest worker timeout', function (): void {
    $retryAfter = config('queue.connections.database.retry_after');
    $longestTimeout = 300;

    expect($retryAfter)->toBeGreaterThan($longestTimeout);
});

it('production workers consume every application queue', function (): void {
    $workflow = file_get_contents(base_path('../.github/workflows/deploy-production.yml'));

    expect($workflow)->not->toBeFalse()
        ->and(substr_count((string) $workflow, '--queue=media,ai,notifications,default'))->toBe(2);
});
