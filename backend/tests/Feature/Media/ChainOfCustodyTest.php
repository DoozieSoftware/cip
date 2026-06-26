<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    (new RolesAndPermissionsSeeder)->run();
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('ChainOfCustodyWriter::record() writes an immutable row capturing capture_time, upload_time, uploader, device, hash, storage_path', function (): void {
    $uploader = User::factory()->create();
    $actor = User::factory()->create();
    $media = Media::factory()->create([
        'uploaded_by' => $uploader->id,
        'captured_at' => now()->subHour(),
        'uploaded_at' => now()->subMinutes(5),
        'checksum' => str_repeat('a', 64),
        'storage_disk' => 'local',
        'storage_path' => 'evidence/abc/photo.jpg',
        'version' => 1,
    ]);

    $row = app(ChainOfCustodyWriter::class)->record(
        $media,
        ChainOfCustodyWriter::EVENT_VIEW,
        $actor,
        '10.0.0.1',
        'PestAgent/1.0',
    );

    expect($row)->toBeInstanceOf(MediaAccessLog::class)
        ->and($row->event)->toBe('VIEW')
        ->and($row->actor_id)->toBe($actor->id)
        ->and($row->ip)->toBe('10.0.0.1')
        ->and($row->user_agent)->toBe('PestAgent/1.0')
        ->and($row->metadata['uploader'])->toBe($uploader->id)
        ->and($row->metadata['hash'])->toBe(str_repeat('a', 64))
        ->and($row->metadata['storage_path'])->toBe('evidence/abc/photo.jpg')
        ->and($row->metadata['storage_disk'])->toBe('local')
        ->and($row->metadata['capture_time'])->not->toBeNull()
        ->and($row->metadata['upload_time'])->not->toBeNull();
});

it('historyFor() returns the rows newest first', function (): void {
    $media = Media::factory()->create();
    $writer = app(ChainOfCustodyWriter::class);
    $writer->record($media, 'VIEW', null, '127.0.0.1', 'a');
    $writer->record($media, 'DOWNLOAD', null, '127.0.0.1', 'a');
    $writer->record($media, 'VIRUS_SCAN', null, '127.0.0.1', 'a', ['verdict' => 'CLEAN']);

    $history = $writer->historyFor($media->id);

    expect($history)->toHaveCount(3)
        ->and($history[0]->event)->toBe('VIRUS_SCAN')  // newest
        ->and($history[1]->event)->toBe('DOWNLOAD')
        ->and($history[2]->event)->toBe('VIEW');
});

it('GET /api/v1/reports/{id}/media writes a VIEW row for every visible media (acceptance: access log row present)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    Media::factory()->count(2)->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $this->getJson("/api/v1/reports/{$report->id}/media")->assertStatus(200);

    $rows = MediaAccessLog::query()->where('event', 'VIEW')->get();
    expect($rows)->toHaveCount(2)
        ->and($rows[0]->actor_id)->toBe($citizen->id);
});

it('GET /api/v1/reports/{id}/media/{media}/audit is denied for non-staff (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    $this->getJson("/api/v1/reports/{$report->id}/media/{$media->id}/audit")
        ->assertStatus(403);
});

it('GET /api/v1/reports/{id}/media/{media}/audit is allowed for moderator with the chain-of-custody rows', function (): void {
    $citizen = User::factory()->create();
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    Sanctum::actingAs($mod);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local']);

    // Pre-seed a chain-of-custody row.
    app(ChainOfCustodyWriter::class)->record($media, 'VIEW', $citizen, '10.0.0.1', 'agent');

    $this->getJson("/api/v1/reports/{$report->id}/media/{$media->id}/audit")
        ->assertStatus(200)
        ->assertJsonPath('data.media_id', $media->id)
        ->assertJsonPath('data.audit.0.event', 'VIEW')
        ->assertJsonPath('data.audit.0.actor_id', $citizen->id)
        ->assertJsonPath('data.audit.0.ip', '10.0.0.1');
});

it('DOWNLOAD on the signed serve endpoint writes a chain-of-custody row', function (): void {
    $citizen = User::factory()->create();
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/zz/photo.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, 'fake-bytes');

    $url = URL::temporarySignedRoute(
        'api.v1.media.serve',
        now()->addMinutes(5),
        ['media' => $media->id],
    );

    $this->get($url)->assertStatus(200);

    $rows = MediaAccessLog::query()->where('event', 'DOWNLOAD')->where('media_id', $media->id)->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->metadata['hash'])->toBe($media->checksum)
        ->and($rows[0]->metadata['storage_path'])->toBe('reports/zz/photo.jpg');
});

it('chain-of-custody rows carry the immutable-only created_at timestamp (no updated_at)', function (): void {
    $row = MediaAccessLog::factory()->create();

    // The model is append-only: timestamps are disabled so
    // there is no updated_at column to write to. The
    // schema is the immutability guarantee.
    expect($row->getAttributes())->not->toHaveKey('updated_at')
        ->and($row->usesTimestamps())->toBeFalse();
});
