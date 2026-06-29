<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ComputeHashesJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Media\Services\HashService;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Media\Services\ThumbnailService;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);


const MFT_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
const MFT_TINY_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function mftJpeg(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mft-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MFT_TINY_JPEG));

    return new UploadedFile($new, 'photo.jpg', 'image/jpeg', null, true);
}

function mftMp4(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mft-');
    $new = $tmp.'.mp4';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MFT_TINY_MP4));

    return new UploadedFile($new, 'clip.mp4', 'video/mp4', null, true);
}

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('happy path: photo upload writes the media row, the bytes, and a chain-of-custody VIEW row', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [mftJpeg()],
    ])->assertStatus(201);

    $media = Media::query()->where('report_id', $report->id)->firstOrFail();
    expect($media->type)->toBe('PHOTO')
        ->and($media->storage_path)->toStartWith("evidence/{$report->id}/photo/")
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue();

    // Re-fetch the list — this is when the VIEW chain-of-custody row is written.
    $this->getJson("/api/v1/reports/{$report->id}/media")->assertStatus(200);
    expect(MediaAccessLog::query()->where('event', 'VIEW')->where('media_id', $media->id)->count())->toBe(1);
});

it('happy path: ComputeHashesJob populates the media_hashes row end-to-end', function (): void {
    Bus::fake([ComputeHashesJob::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mftJpeg()]])->assertStatus(201);
    $media = Media::query()->where('report_id', $report->id)->firstOrFail();

    // Run the job synchronously now.
    (new ComputeHashesJob($media->id))->handle(app(HashService::class));

    $hash = MediaHash::query()->where('media_id', $media->id)->firstOrFail();
    expect($hash->sha256)->toHaveLength(64)
        ->and($hash->sha512)->toHaveLength(128)
        ->and($hash->perceptual_hash)->toHaveLength(16)
        ->and($hash->video_fingerprint)->toBeNull();

    $media->refresh();
    expect($media->checksum)->toBe($hash->sha256);
});

it('happy path: GenerateThumbnailJob writes the 320px thumbnail onto the media row metadata', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mftJpeg()]])->assertStatus(201);
    $media = Media::query()->where('report_id', $report->id)->firstOrFail();

    (new GenerateThumbnailJob($media->id))->handle(app(ThumbnailService::class));

    $media->refresh();
    expect($media->metadata['thumbnails']['320'] ?? null)
        ->toBeString()
        ->and(Storage::disk('local')->exists($media->metadata['thumbnails']['320']))->toBeTrue();
});

it('happy path: video upload dispatches both ComputeHashesJob and ExtractVideoMetadataJob', function (): void {
    Bus::fake([ComputeHashesJob::class, ExtractVideoMetadataJob::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mftMp4(),
        'duration_seconds' => 10,
    ])->assertStatus(201);

    Bus::assertDispatched(ComputeHashesJob::class);
    Bus::assertDispatched(ExtractVideoMetadataJob::class);
});

it('happy path: signed URL playback works (15-min TTL, MediaUrl helper)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/happy/photo.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(MFT_TINY_JPEG));

    $url = (new MediaUrl)->temporary($media, 15);
    $this->get($url)->assertStatus(200);
});
