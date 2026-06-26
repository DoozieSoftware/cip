<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Models\Media;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Storage;

const EVMJ_TINY_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

beforeEach(function (): void {
    Storage::fake('local');
});

it('uses tries=3 with 30s backoff', function (): void {
    $job = new ExtractVideoMetadataJob('00000000-0000-7000-8000-000000000001');
    expect($job->tries)->toBe(3)->and($job->backoff)->toBe(30);
});

it('implements ShouldQueue', function (): void {
    $job = new ExtractVideoMetadataJob('00000000-0000-7000-8000-000000000001');
    expect($job)->toBeInstanceOf(ShouldQueue::class);
});

it('writes 320x240 / 4s when ffprobe returns that (acceptance, ffprobe stubbed)', function (): void {
    $media = Media::factory()->create([
        'type' => 'VIDEO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/clip.mp4',
        'mime' => 'video/mp4',
        'duration' => null,
        'width' => null,
        'height' => null,
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(EVMJ_TINY_MP4));

    // Build a fake ffprobe shell script that prints width/height/duration
    // in the format the job parses. The job's exec() call uses
    // escapeshellcmd on the binary name, so the test points the
    // binary argument at a temp script.
    $stub = tempnam(sys_get_temp_dir(), 'cip-ff-').'.sh';
    file_put_contents($stub, "#!/bin/sh\necho 320\necho 240\necho 4.0\n");
    chmod($stub, 0o755);

    $job = new ExtractVideoMetadataJob($media->id, $stub);
    $job->handle();

    $media->refresh();
    expect($media->width)->toBe(320)
        ->and($media->height)->toBe(240)
        ->and($media->duration)->toBe(4);
});

it('falls back to the upload-time metadata hints when ffprobe is missing', function (): void {
    $media = Media::factory()->create([
        'type' => 'VIDEO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/clip.mp4',
        'mime' => 'video/mp4',
        'duration' => null,
        'width' => null,
        'height' => null,
        'metadata' => [
            'upload' => [
                'width' => 1920,
                'height' => 1080,
                'duration' => 12,
            ],
        ],
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(EVMJ_TINY_MP4));

    $stub = tempnam(sys_get_temp_dir(), 'cip-ff-').'.sh';
    file_put_contents($stub, "#!/bin/sh\nexit 1\n"); // simulate ffprobe failure
    chmod($stub, 0o755);

    $job = new ExtractVideoMetadataJob($media->id, $stub);
    $job->handle();

    $media->refresh();
    expect($media->width)->toBe(1920)
        ->and($media->height)->toBe(1080)
        ->and($media->duration)->toBe(12);
});

it('is a no-op for non-video assets', function (): void {
    $photo = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/photo.jpg',
        'mime' => 'image/jpeg',
        'width' => 1280,
        'height' => 720,
    ]);

    $job = new ExtractVideoMetadataJob($photo->id, '/nonexistent/ffprobe');
    $job->handle();

    $photo->refresh();
    // No metadata write happened, original values stay null
    expect($photo->width)->toBe(1280)
        ->and($photo->height)->toBe(720)
        ->and($photo->duration)->toBeNull();
});

it('is a no-op when the media row has been deleted', function (): void {
    Log::spy();

    (new ExtractVideoMetadataJob('00000000-0000-7000-8000-deadbeef0000', '/bin/true'))
        ->handle();

    Illuminate\Support\Facades\Log::shouldHaveReceived('info')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.video_metadata.skipped_missing_media')
        ->once();
});

it('throws and logs when the source asset is missing on disk', function (): void {
    Log::spy();
    $media = Media::factory()->create([
        'type' => 'VIDEO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/zz/missing.mp4',
        'mime' => 'video/mp4',
    ]);

    $job = new ExtractVideoMetadataJob($media->id, '/bin/true');
    expect(fn () => $job->handle())->toThrow(RuntimeException::class);

    Illuminate\Support\Facades\Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.video_metadata.failed'
            && ($ctx['media_id'] ?? null) === $media->id)
        ->once();
});

it('tags itself for queue metrics', function (): void {
    $job = new ExtractVideoMetadataJob('00000000-0000-7000-8000-0000000000ff', '/bin/true');
    expect($job->tags())->toBe(['media', 'media.video_metadata', 'media:00000000-0000-7000-8000-0000000000ff']);
});
