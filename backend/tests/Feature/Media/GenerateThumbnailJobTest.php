<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ThumbnailService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;

const GTJ_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

it('can be dispatched via Bus::fake and the dispatched job is asserted (acceptance)', function (): void {
    Bus::fake([GenerateThumbnailJob::class]);

    GenerateThumbnailJob::dispatch('00000000-0000-7000-8000-000000000001');

    Bus::assertDispatched(GenerateThumbnailJob::class, function (GenerateThumbnailJob $job): bool {
        return $job->mediaId === '00000000-0000-7000-8000-000000000001';
    });
});

it('uses tries=3 with a 30s backoff (docs/14 §16 retry policy)', function (): void {
    $job = new GenerateThumbnailJob('00000000-0000-7000-8000-000000000001');

    expect($job->tries)->toBe(3)
        ->and($job->backoff)->toBe(30);
});

it('implements ShouldQueue so it actually goes on the queue', function (): void {
    $job = new GenerateThumbnailJob('00000000-0000-7000-8000-000000000001');

    expect($job)->toBeInstanceOf(ShouldQueue::class);
});

it('runs handle(): generates the thumbnail and persists the path on the media metadata', function (): void {
    Storage::fake('local');

    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/photo.jpg',
        'mime' => 'image/jpeg',
        'metadata' => [],
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(GTJ_TINY_JPEG));

    (new GenerateThumbnailJob($media->id))->handle(app(ThumbnailService::class));

    $media->refresh();
    $path = $media->metadata['thumbnails']['320'] ?? null;

    expect($path)->toBeString()
        ->and(Storage::disk('local')->exists($path))->toBeTrue();
});

it('handle() is a no-op when the media row has been deleted between dispatch and execution', function (): void {
    Log::spy();

    // No Media row with this id
    (new GenerateThumbnailJob('00000000-0000-7000-8000-deadbeef0000'))
        ->handle(app(ThumbnailService::class));

    Illuminate\Support\Facades\Log::shouldHaveReceived('info')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.thumbnail.skipped_missing_media')
        ->once();
});

it('handle() logs and rethrows on ThumbnailService failure so the queue can retry', function (): void {
    Storage::fake('local');
    Log::spy();

    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/missing/file.jpg',
        'mime' => 'image/jpeg',
    ]);
    // Note: we did NOT put the file on disk, so ThumbnailService will throw.

    $job = new GenerateThumbnailJob($media->id);

    expect(fn () => $job->handle(app(ThumbnailService::class)))
        ->toThrow(RuntimeException::class);

    Illuminate\Support\Facades\Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.thumbnail.failed'
            && ($ctx['media_id'] ?? null) === $media->id)
        ->once();
});

it('tags itself for queue metrics so the ops dashboard can filter', function (): void {
    $job = new GenerateThumbnailJob('00000000-0000-7000-8000-0000000000ff');

    expect($job->tags())->toBe(['media', 'media.thumbnail', 'media:00000000-0000-7000-8000-0000000000ff']);
});
