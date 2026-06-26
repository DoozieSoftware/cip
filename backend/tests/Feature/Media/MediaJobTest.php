<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Media\Services\HashService;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Media\Services\ThumbnailService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

/**
 * M5 queue behaviour. Per docs/14 §16 every media
 * post-processing job must:
 *  - be dispatched when the upload succeeds
 *  - declare `media` as its queue (so Horizon / CloudWatch
 *    can carve out a dedicated worker pool)
 *  - run to completion against the live database
 */
const MJT_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
const MJT_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function mjtJpeg(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mjt-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MJT_JPEG));

    return new UploadedFile($new, 'photo.jpg', 'image/jpeg', null, true);
}

function mjtMp4(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mjt-');
    $new = $tmp.'.mp4';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MJT_MP4));

    return new UploadedFile($new, 'clip.mp4', 'video/mp4', null, true);
}

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('photo upload dispatches ComputeHashesJob + GenerateThumbnailJob on the media queue', function (): void {
    Queue::fake();

    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mjtJpeg()]])->assertStatus(201);

    Queue::assertPushed(ComputeHashesJob::class, fn (ComputeHashesJob $j): bool => $j->queue === 'media');
    Queue::assertPushed(GenerateThumbnailJob::class, fn (GenerateThumbnailJob $j): bool => $j->queue === 'media');
    Queue::assertNotPushed(ExtractVideoMetadataJob::class);
});

it('video upload dispatches ComputeHashesJob + ExtractVideoMetadataJob on the media queue', function (): void {
    Queue::fake();

    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mjtMp4(),
        'duration_seconds' => 10,
    ])->assertStatus(201);

    Queue::assertPushed(ComputeHashesJob::class, fn (ComputeHashesJob $j): bool => $j->queue === 'media');
    Queue::assertPushed(ExtractVideoMetadataJob::class, fn (ExtractVideoMetadataJob $j): bool => $j->queue === 'media');
    Queue::assertNotPushed(GenerateThumbnailJob::class);
});

it('ComputeHashesJob runs to completion and populates the media_hashes row', function (): void {
    Bus::fake([ComputeHashesJob::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mjtJpeg()]])->assertStatus(201);
    $media = Media::query()->where('report_id', $report->id)->firstOrFail();

    (new ComputeHashesJob($media->id))->handle(app(HashService::class));

    $hash = MediaHash::query()->where('media_id', $media->id)->firstOrFail();
    expect($hash->sha256)->toHaveLength(64)
        ->and($hash->sha512)->toHaveLength(128)
        ->and($hash->perceptual_hash)->toHaveLength(16)
        ->and($hash->video_fingerprint)->toBeNull();

    $media->refresh();
    expect($media->checksum)->toBe($hash->sha256);
});

it('GenerateThumbnailJob writes the 320 thumbnail to disk and onto the media metadata', function (): void {
    Bus::fake([GenerateThumbnailJob::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mjtJpeg()]])->assertStatus(201);
    $media = Media::query()->where('report_id', $report->id)->firstOrFail();

    (new GenerateThumbnailJob($media->id))->handle(app(ThumbnailService::class));

    $media->refresh();
    $thumb = $media->metadata['thumbnails']['320'] ?? null;
    expect($thumb)->toBeString()->and(Storage::disk('local')->exists($thumb))->toBeTrue();
});

it('ExtractVideoMetadataJob populates duration from upload metadata when ffprobe is missing', function (): void {
    Bus::fake([ExtractVideoMetadataJob::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mjtMp4(),
        'duration_seconds' => 10,
    ])->assertStatus(201);
    $media = Media::query()->where('report_id', $report->id)->firstOrFail();

    // Manual handle(): with no ffprobe on PATH, the job
    // falls back to the metadata that was passed at upload
    // time (duration_seconds). It should not throw.
    (new ExtractVideoMetadataJob($media->id, 'ffprobe-missing-stub'))->handle();

    $media->refresh();
    // The job falls back to duration=10 (the value the
    // citizen provided at upload) when ffprobe is absent.
    expect((int) $media->duration)->toBe(10);
});
