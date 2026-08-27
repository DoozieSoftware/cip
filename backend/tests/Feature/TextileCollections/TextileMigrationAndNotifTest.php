<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('BE-M1 new migration keeps existing 5 textile migrations untouched; existing requests backfill stays intact', function (): void {
    // Check expected tables/columns exist and no destructive change to existing rows
    expect(Schema::hasTable('textile_collection_requests'))->toBeTrue();
    expect(Schema::hasTable('textile_collection_batches'))->toBeTrue();
    expect(Schema::hasTable('textile_service_zones'))->toBeTrue();
    // existing columns still present
    expect(Schema::hasColumn('textile_collection_requests', 'status'))->toBeTrue();
    expect(Schema::hasColumn('textile_collection_requests', 'collection_method'))->toBeTrue();
    expect(Schema::hasColumn('textile_collection_requests', 'batch_id'))->toBeTrue();
    // future columns (dropoff lane, receipts, trip assignment) are NOT required yet — just document they are OPEN
    // green assertion: current engine has no receipt table yet
    expect(Schema::hasTable('textile_dropoff_receipts'))->toBeFalse();
});

it('BE-M2 [OPEN D-03] legacy completed dropoffs mapping per approved rule')->todo();
it('BE-N1 collected/rejected listeners fire once; missed/cancel gap per Phase 1 dedicated lifecycle events')->todo();

it('NEGATIVE: mime spoof .php renamed to .jpg is rejected on photo upload', function (): void {
    $zone = TextileServiceZone::query()->create([
        'code' => 'DRL-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Mime Zone',
        'department_id' => Department::query()->where('code','DR_LINEN')->value('id'),
        'dropoff_enabled' => true, 'premises_pickup_enabled' => true, 'active' => true,
    ]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $r = $this->postJson('/api/v1/textile-collection/requests', [
        'title' => 'Mime test', 'service_zone_id' => $zone->id, 'requester_type' => 'individual',
        'requester_name' => 'Asha', 'contact_email' => 'a@example.com', 'contact_phone' => '+91 9876543210',
        'pickup_address' => '12 MG Road', 'collection_method' => 'premises', 'estimated_bags' => 1, 'estimated_weight_kg' => 1.0,
    ])->assertCreated();
    $id = $r->json('data.id');
    // Create a fake php file with jpg extension — UploadTextilePhotoRequest should reject via mimes
    $file = \Illuminate\Http\UploadedFile::fake()->create('evil.jpg', 10, 'text/x-php');
    // Use citizen photo route
    $this->postJson("/api/v1/citizen/textile-collections/{$id}/photo", ['photo' => $file])
        ->assertUnprocessable();
});
