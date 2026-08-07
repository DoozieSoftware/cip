<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\MediaDeliveryService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
});

it('returns 404 when media not found', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $service = new MediaDeliveryService(new ChainOfCustodyWriter);
    $response = $service->serve('00000000-0000-7000-8000-000000000000');

    expect($response->getStatusCode())->toBe(404);
    expect(json_decode($response->getContent(), true)['message'])->toBe('Media not found');
});

it('returns 410 when media bytes missing on storage', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $report = Report::factory()->create();

    $media = Media::factory()->create([
        'report_id' => $report->id,
        'storage_disk' => 'local',
        'storage_path' => 'evidence/abc/photo.jpg',
    ]);

    $service = new MediaDeliveryService(new ChainOfCustodyWriter);
    $response = $service->serve($media->id);

    expect($response->getStatusCode())->toBe(410);
});

it('serves file with correct content type when bytes exist', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $report = Report::factory()->create();

    $media = Media::factory()->create([
        'report_id' => $report->id,
        'storage_disk' => 'local',
        'storage_path' => 'evidence/abc/photo.jpg',
        'mime' => 'image/jpeg',
    ]);

    Storage::disk('local')->put($media->storage_path, 'fake-jpeg-bytes');

    $service = new MediaDeliveryService(new ChainOfCustodyWriter);
    $response = $service->serve($media->id);

    expect($response->getStatusCode())->toBe(200);
});
