<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\LogScanner;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
    $this->app->bind(MediaService::class, fn () => new MediaService(new MimeValidator, new LogScanner));
    RateLimiter::clear('citizen');
    Cache::flush();
});

it('returns the media list with a signed_url for every row (TTL 15 min)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    Media::factory()->count(3)->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
    ]);

    $resp = $this->getJson("/api/v1/reports/{$report->id}/media");

    $resp->assertStatus(200)
        ->assertJsonCount(3, 'data.media');

    foreach ($resp->json('data.media') as $row) {
        expect($row)->toHaveKey('signed_url')
            ->and($row['signed_url'])->toContain('signature=')
            ->and($row)->toHaveKey('signed_url_expires_at')
            ->and($row)->not->toHaveKey('storage_path')
            ->and($row)->not->toHaveKey('storage_disk');
    }
});

it('hides storage_path from non-staff (citizen)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local', 'storage_path' => 'evidence/abc/photo.jpg']);

    $this->getJson("/api/v1/reports/{$report->id}/media")
        ->assertStatus(200)
        ->assertJsonMissingPath('data.media.0.storage_path');
});

it('exposes storage_path to super_admin with include_storage_path=true', function (): void {
    $citizen = User::factory()->create();
    $admin = User::factory()->create();
    // Grant super_admin role (assumes M2's RoleService / spatie)
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    Media::factory()->create(['report_id' => $report->id, 'type' => 'PHOTO', 'storage_disk' => 'local', 'storage_path' => 'evidence/abc/photo.jpg']);

    $this->getJson("/api/v1/reports/{$report->id}/media?include_storage_path=1")
        ->assertStatus(200)
        ->assertJsonPath('data.media.0.storage_path', fn ($v) => is_string($v) && str_starts_with($v, 'evidence/'))
        ->assertJsonPath('data.media.0.storage_disk', 'local');
});

it('returns 404 when the report does not exist', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/00000000-0000-7000-8000-000000000000/media')
        ->assertStatus(404);
});

it('signed URL works within the 15-min TTL (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/x/photo.jpg',
        'mime' => 'image/jpeg',
    ]);
    Storage::disk('local')->put($media->storage_path, 'fake-jpeg-bytes');

    $url = URL::temporarySignedRoute(
        'api.v1.media.serve',
        now()->addMinutes(10),
        ['media' => $media->id],
    );

    $this->get($url)->assertStatus(200);
});

it('expired signed URL returns 403 (acceptance)', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen, ['citizen']);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/y/photo.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, 'fake-jpeg-bytes');

    $url = URL::temporarySignedRoute(
        'api.v1.media.serve',
        now()->subMinutes(1), // expired
        ['media' => $media->id],
    );

    $this->get($url)->assertStatus(403);
});
