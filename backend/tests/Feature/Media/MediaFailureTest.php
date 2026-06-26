<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

/**
 * M5 failure-mode coverage. Every assertion here corresponds
 * to a documented rejection path in docs/05 §14 and docs/11
 * §32:
 *
 *  - server-mime / magic-bytes gate (MIME mismatch)
 *  - per-type size cap (oversize photo)
 *  - per-type video duration window (too long, too short)
 *  - per-type count cap (11th photo, 2nd video)
 *  - signed-URL TTL (expired)
 */
const MFT_FAIL_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
const MFT_FAIL_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MFT_FAIL_PDF = '%PDF-1.4';

function mftFailJpeg(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mftfail-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MFT_FAIL_JPEG));

    return new UploadedFile($new, 'photo.jpg', 'image/jpeg', null, true);
}

function mftFailPdf(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mftfail-');
    $new = $tmp.'.pdf';
    rename($tmp, $new);
    file_put_contents($new, MFT_FAIL_PDF);

    return new UploadedFile($new, 'doc.pdf', 'application/pdf', null, true);
}

function mftFailMp4(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mftfail-');
    $new = $tmp.'.mp4';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MFT_FAIL_MP4));

    return new UploadedFile($new, 'clip.mp4', 'video/mp4', null, true);
}

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('rejects photo upload when the client and server mime disagree (MIME mismatch)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // The bytes are a real JPEG, but the client claims PDF mime.
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mftfail-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(MFT_FAIL_JPEG));
    $file = new UploadedFile($new, 'photo.jpg', 'application/pdf', null, true);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [$file]]);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'MEDIA_INVALID_MIME');

    expect(Media::query()->where('report_id', $report->id)->count())->toBe(0);
});

it('rejects an oversize photo with VALIDATION_FAILED (16 MB cap)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // 17 MB photo — over the 16 MB cap.
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mftfail-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    $h = fopen($new, 'wb');
    fwrite($h, base64_decode(MFT_FAIL_JPEG));
    // Pad up to 17 MB so the file is genuinely over the cap.
    fseek($h, 17 * 1024 * 1024 - 1);
    fwrite($h, "\x00");
    fclose($h);
    $file = new UploadedFile($new, 'huge.jpg', 'image/jpeg', null, true);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [$file]]);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');

    expect(Media::query()->where('report_id', $report->id)->count())->toBe(0);
});

it('rejects a video shorter than 3 seconds (VALIDATION_FAILED)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mftFailMp4(),
        'duration_seconds' => 1,
    ]);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');

    expect(Media::query()->where('report_id', $report->id)->count())->toBe(0);
});

it('rejects a video longer than 300 seconds (VALIDATION_FAILED)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mftFailMp4(),
        'duration_seconds' => 999,
    ]);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');

    expect(Media::query()->where('report_id', $report->id)->count())->toBe(0);
});

it('rejects the 11th photo on a report with VALIDATION_FAILED', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // Persist 10 valid photo rows directly so the 11th upload
    // hits the per-report cap. (The HTTP route itself is
    // throttled to 100 MB/hour so uploading 10 real files
    // would be slow and flaky in tests.)
    for ($i = 0; $i < 10; $i++) {
        Media::factory()->create([
            'report_id' => $report->id,
            'type' => 'PHOTO',
            'storage_path' => "evidence/{$report->id}/photo/factory-{$i}.jpg",
        ]);
    }

    $resp = $this->postJson("/api/v1/reports/{$report->id}/photos", ['photos' => [mftFailJpeg()]]);

    $resp->assertStatus(422)
        ->assertJsonPath('code', 'VALIDATION_FAILED');

    expect(Media::query()->where('report_id', $report->id)->where('type', 'PHOTO')->count())->toBe(10);
});

it('rejects a second video on a report with 409 VIDEO_ALREADY_PRESENT', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // One video already present.
    Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'VIDEO',
        'storage_path' => "evidence/{$report->id}/video/factory-1.mp4",
    ]);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/video", [
        'video' => mftFailMp4(),
        'duration_seconds' => 10,
    ]);

    $resp->assertStatus(409)
        ->assertJsonPath('code', 'VIDEO_ALREADY_PRESENT');

    expect(Media::query()->where('report_id', $report->id)->where('type', 'VIDEO')->count())->toBe(1);
});

it('rejects an expired signed URL with 403', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/expired/photo.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(MFT_FAIL_JPEG));

    // Sign the URL with an expiration 1 hour in the past.
    $expiredUrl = URL::temporarySignedRoute(
        'api.v1.media.serve',
        now()->subHour(),
        ['media' => $media->id],
    );

    $this->get($expiredUrl)->assertStatus(403);
});
