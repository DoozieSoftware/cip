<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ComputeHashesJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
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


const UPE_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

function upeJpeg(): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-up-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, base64_decode(UPE_TINY_JPEG));

    return new UploadedFile($new, 'photo.jpg', 'image/jpeg', null, true);
}

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    // Reset the throttle + cache between tests.
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('returns 201 with the media array on success (acceptance)', function (): void {
    Bus::fake([ComputeHashesJob::class, GenerateThumbnailJob::class]);

    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $resp = $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [upeJpeg(), upeJpeg()],
    ]);

    $resp->assertStatus(201)
        ->assertJsonPath('data.media.0.id', fn ($v) => is_string($v) && $v !== '')
        ->assertJsonPath('data.media.1.id', fn ($v) => is_string($v) && $v !== '')
        ->assertJsonPath('meta.count', 2);

    expect(Media::query()->where('report_id', $report->id)->count())->toBe(2);
});

it('dispatches ComputeHashesJob + GenerateThumbnailJob for every uploaded photo', function (): void {
    Bus::fake([ComputeHashesJob::class, GenerateThumbnailJob::class]);

    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [upeJpeg(), upeJpeg()],
    ])->assertStatus(201);

    Bus::assertDispatchedTimes(ComputeHashesJob::class, 2);
    Bus::assertDispatchedTimes(GenerateThumbnailJob::class, 2);
});

it('returns 422 when the size cap is hit (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // 16 MB + 1 byte
    $tmp = tempnam(sys_get_temp_dir(), 'cip-up-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    $base = base64_decode(UPE_TINY_JPEG);
    file_put_contents($new, $base.str_repeat("\x00", 16 * 1024 * 1024));
    $big = new UploadedFile($new, 'big.jpg', 'image/jpeg', null, true);

    $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [$big],
    ])->assertStatus(422);
});

it('returns 422 when the type is wrong (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    // Send a plain text file under photos[] — the mime gate
    // (text/plain) is not in the PHOTO allowed set, so the
    // service throws MEDIA_INVALID_MIME -> 422.
    $tmp = tempnam(sys_get_temp_dir(), 'cip-up-');
    $new = $tmp.'.txt';
    rename($tmp, $new);
    file_put_contents($new, 'not an image');
    $txt = new UploadedFile($new, 'note.txt', 'text/plain', null, true);

    $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [$txt],
    ])->assertStatus(422);
});

it('returns 404 when the report does not exist', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);

    $this->postJson('/api/v1/reports/00000000-0000-7000-8000-000000000000/photos', [
        'photos' => [upeJpeg()],
    ])->assertStatus(404);
});

it('requires authentication (401 without Sanctum)', function (): void {
    $report = Report::factory()->create();

    $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [upeJpeg()],
    ])->assertStatus(401);
});

it('returns 403 when the citizen does not own the report (acceptance: IDOR guard)', function (): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    Sanctum::actingAs($other, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $owner->id]);

    $this->postJson("/api/v1/reports/{$report->id}/photos", [
        'photos' => [upeJpeg()],
    ])->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});
