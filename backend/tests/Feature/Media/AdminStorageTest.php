<?php

declare(strict_types=1);

use App\Modules\Settings\Models\Setting;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function storageSuperAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('rejects the storage config without auth', function (): void {
    $this->getJson('/api/v1/admin/media/storage')->assertStatus(401);
});

it('rejects a non-admin on the storage config', function (): void {
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/media/storage')->assertStatus(403);
});

it('returns defaults on first read and seeds the settings row', function (): void {
    Sanctum::actingAs(storageSuperAdmin());

    $r = $this->getJson('/api/v1/admin/media/storage');
    $r->assertOk()
        ->assertJsonPath('data.key', 'media_storage')
        ->assertJsonPath('data.disk', 'media_local')
        ->assertJsonPath('data.retention_days', 0)
        ->assertJsonPath('data.encryption_at_rest', false);
    expect(Setting::query()->where('key', 'media_storage')->exists())->toBeTrue();
});

it('updates the disk + retention and flips cip.media.disk at runtime', function (): void {
    Sanctum::actingAs(storageSuperAdmin());

    $r = $this->putJson('/api/v1/admin/media/storage', [
        'disk' => 'media_minio',
        'retention_days' => 90,
        'encryption_at_rest' => true,
        'max_photo_bytes' => 8 * 1024 * 1024,
        'max_video_bytes' => 50 * 1024 * 1024,
        'max_document_bytes' => 10 * 1024 * 1024,
        'region' => 'ap-south-1',
        'bucket' => 'cip-media',
        'endpoint' => 'https://minio.example.com',
    ]);

    $r->assertOk()
        ->assertJsonPath('data.disk', 'media_minio')
        ->assertJsonPath('data.retention_days', 90)
        ->assertJsonPath('data.encryption_at_rest', true)
        ->assertJsonPath('data.bucket', 'cip-media')
        ->assertJsonPath('data.endpoint', 'https://minio.example.com');

    expect(config('cip.media.disk'))->toBe('media_minio');

    $stored = Setting::query()->where('key', 'media_storage')->first();
    expect($stored->value['disk'])->toBe('media_minio');
    expect($stored->value['retention_days'])->toBe(90);
});

it('rejects an unknown disk with 422', function (): void {
    Sanctum::actingAs(storageSuperAdmin());

    $this->putJson('/api/v1/admin/media/storage', [
        'disk' => 'ftp',
        'retention_days' => 1,
        'encryption_at_rest' => false,
        'max_photo_bytes' => 1,
        'max_video_bytes' => 1,
        'max_document_bytes' => 1,
    ])->assertStatus(422);
});

it('probes the configured disk and reports reachability', function (): void {
    Storage::fake('media_local');

    Sanctum::actingAs(storageSuperAdmin());

    $r = $this->postJson('/api/v1/admin/media/storage/probe');
    $r->assertOk()->assertJsonPath('data.disk', 'media_local');
    expect($r->json('data.reachable'))->toBeTrue();
});
