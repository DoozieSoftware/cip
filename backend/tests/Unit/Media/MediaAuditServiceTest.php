<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\MediaAuditService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    Storage::fake('local');
    config(['cip.media.disk' => 'local']);
});

it('returns 404 when media not found', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);
    $report = Report::factory()->create();

    $service = new MediaAuditService(new ChainOfCustodyWriter);
    $response = $service->audit($report->id, '00000000-0000-7000-8000-000000000000', request());

    expect($response->getStatusCode())->toBe(404);
});

it('returns 403 for non-staff users', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);
    $media = Media::factory()->create(['report_id' => $report->id]);

    $service = new MediaAuditService(new ChainOfCustodyWriter);
    $response = $service->audit($report->id, $media->id, request());

    expect($response->getStatusCode())->toBe(403);
});

it('returns audit history for staff users', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);
    $report = Report::factory()->create();
    $media = Media::factory()->create(['report_id' => $report->id]);

    $service = new MediaAuditService(new ChainOfCustodyWriter);
    $response = $service->audit($report->id, $media->id, request());

    expect($response->getStatusCode())->toBe(200);
    $data = json_decode($response->getContent(), true);
    expect($data['data']['media_id'])->toBe($media->id);
    expect($data['data']['audit'])->toBeArray();
});
