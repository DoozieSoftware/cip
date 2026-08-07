<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\MediaIndexService;
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

it('returns only evidence media for non-staff users', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $report = Report::factory()->create(['citizen_id' => $citizen->id]);

    Media::factory()->count(2)->create([
        'report_id' => $report->id,
        'role' => 'evidence',
        'storage_disk' => 'local',
    ]);
    Media::factory()->create([
        'report_id' => $report->id,
        'role' => 'proof',
        'storage_disk' => 'local',
    ]);

    $service = new MediaIndexService(new ChainOfCustodyWriter);
    $result = $service->listForReport($report->id, $citizen, request());

    expect($result)->toHaveCount(2);
});

it('returns all media for staff readers', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);
    $report = Report::factory()->create();

    Media::factory()->count(2)->create([
        'report_id' => $report->id,
        'role' => 'evidence',
        'storage_disk' => 'local',
    ]);
    Media::factory()->create([
        'report_id' => $report->id,
        'role' => 'proof',
        'storage_disk' => 'local',
    ]);

    $service = new MediaIndexService(new ChainOfCustodyWriter);
    $result = $service->listForReport($report->id, $moderator, request());

    expect($result)->toHaveCount(3);
});

it('identifies super_admin as staff', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $service = new MediaIndexService(new ChainOfCustodyWriter);

    expect($service->isStaff($admin))->toBeTrue();
});

it('identifies non-super_admin as non-staff', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    $service = new MediaIndexService(new ChainOfCustodyWriter);

    expect($service->isStaff($moderator))->toBeFalse();
});
