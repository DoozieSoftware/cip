<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ComputeHashesJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);


const UVE_TINY_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function uveMp4(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-uv-');
    $new = $tmp.'.mp4';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(UVE_TINY_MP4));

    return new UploadedFile($new, 'clip.mp4', 'video/mp4', null, true);
}

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('returns 201 on first video upload (acceptance)', function (): void {
    Bus::fake([ComputeHashesJob::class, ExtractVideoMetadataJob::class]);

    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create();

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => uveMp4(),
        'duration_seconds' => 10,
    ])->assertStatus(201)
        ->assertJsonPath('data.media.id', fn ($v) => is_string($v) && $v !== '');

    Bus::assertDispatched(ComputeHashesJob::class);
    Bus::assertDispatched(ExtractVideoMetadataJob::class);
});

it('returns 409 on the second video upload (acceptance: VIDEO_ALREADY_PRESENT)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create();

    // Pre-seed a video row.
    Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'VIDEO',
    ]);

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => uveMp4(),
        'duration_seconds' => 10,
    ])->assertStatus(409)
        ->assertJsonPath('code', 'VIDEO_ALREADY_PRESENT');
});

it('returns 422 on duration below the 3s window (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create();

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => uveMp4(),
        'duration_seconds' => 1,
    ])->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');
});

it('returns 422 on duration above the 300s window', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create();

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => uveMp4(),
        'duration_seconds' => 400,
    ])->assertStatus(422);
});

it('returns 422 when the type is not a video', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create();

    $tmp = tempnam(sys_get_temp_dir(), 'cip-uv-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z'));
    $jpg = new UploadedFile($new, 'photo.jpg', 'image/jpeg', null, true);

    $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => $jpg,
        'duration_seconds' => 10,
    ])->assertStatus(422)
        ->assertJsonPath('code', 'MEDIA_INVALID_MIME');
});
