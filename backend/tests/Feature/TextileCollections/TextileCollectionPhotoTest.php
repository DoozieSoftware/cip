<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Media\Models\Media;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

function textileZonePhoto(array $overrides = []): TextileServiceZone
{
    $drLinenId = Department::query()->where('code', 'DR_LINEN')->value('id');

    return TextileServiceZone::query()->create(array_merge([
        'code' => 'DRL-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'South Bengaluru',
        'department_id' => $drLinenId,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ], $overrides));
}

function createTextileRequestPhoto(User $citizen, TextileServiceZone $zone): TextileCollectionRequest
{
    Sanctum::actingAs($citizen);

    $response = test()->postJson('/api/v1/textile-collection/requests', [
        'title' => 'Household clothes collection',
        'service_zone_id' => $zone->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '12, MG Road, Bengaluru 560001',
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
    ]);

    $response->assertCreated();

    return TextileCollectionRequest::query()->findOrFail($response->json('data.id'));
}

function signInDrLinenStaffPhoto(): User
{
    $staff = User::factory()->create();
    $department = Department::query()->where('code', 'DR_LINEN')->firstOrFail();
    $staff->departments()->attach($department->id, ['active' => true]);
    Sanctum::actingAs($staff);

    return $staff;
}

function attachProofPhoto(TextileCollectionRequest $collection, User $staff): Media
{
    $file = UploadedFile::fake()->image('proof.jpg', 100, 100)->size(100);
    $response = test()->postJson(
        "/api/v1/department/textile-collections/{$collection->id}/proof",
        ['photo' => $file],
    );
    $response->assertCreated();

    return Media::query()->where('textile_collection_id', $collection->id)
        ->where('role', 'proof')
        ->first();
}

// --- Citizen evidence photo tests ---

it('allows the owning citizen to upload an evidence photo', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);

    Sanctum::actingAs($citizen);
    $file = UploadedFile::fake()->image('evidence.jpg', 200, 200)->size(200);

    $response = $this->postJson(
        "/api/v1/citizen/textile-collections/{$collection->id}/photo",
        ['photo' => $file],
    );

    $response->assertCreated()
        ->assertJsonPath('data.photo.role', 'evidence')
        ->assertJsonStructure(['data' => ['photo' => ['id', 'role', 'url']]]);

    $this->assertDatabaseHas('media', [
        'textile_collection_id' => $collection->id,
        'role' => 'evidence',
        'report_id' => null,
    ]);
});

it('replaces the previous citizen evidence photo on re-upload', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);

    Sanctum::actingAs($citizen);

    // Upload first photo
    $file1 = UploadedFile::fake()->image('first.jpg', 200, 200)->size(200);
    $this->postJson(
        "/api/v1/citizen/textile-collections/{$collection->id}/photo",
        ['photo' => $file1],
    )->assertCreated();

    $firstMedia = Media::query()
        ->where('textile_collection_id', $collection->id)
        ->where('role', 'evidence')
        ->first();

    expect($firstMedia->is_replaced)->toBeFalse();

    // Upload second photo — first should be marked replaced
    $file2 = UploadedFile::fake()->image('second.jpg', 200, 200)->size(200);
    $this->postJson(
        "/api/v1/citizen/textile-collections/{$collection->id}/photo",
        ['photo' => $file2],
    )->assertCreated();

    $firstMedia->refresh();
    expect($firstMedia->is_replaced)->toBeTrue();

    // Only one non-replaced evidence photo should exist
    $activeEvidence = Media::query()
        ->where('textile_collection_id', $collection->id)
        ->where('role', 'evidence')
        ->where('is_replaced', false)
        ->count();

    expect($activeEvidence)->toBe(1);
});

it('returns 403 when a different citizen tries to upload a photo', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);

    $otherCitizen = User::factory()->create();
    Sanctum::actingAs($otherCitizen);

    $file = UploadedFile::fake()->image('photo.jpg', 200, 200)->size(200);

    $this->postJson(
        "/api/v1/citizen/textile-collections/{$collection->id}/photo",
        ['photo' => $file],
    )->assertForbidden();
});

// --- Staff proof photo tests ---

it('allows staff to upload a proof photo', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);
    $staff = signInDrLinenStaffPhoto();

    $file = UploadedFile::fake()->image('proof.jpg', 200, 200)->size(200);

    $response = $this->postJson(
        "/api/v1/department/textile-collections/{$collection->id}/proof",
        ['photo' => $file],
    );

    $response->assertCreated()
        ->assertJsonPath('data.photo.role', 'proof')
        ->assertJsonStructure(['data' => ['photo' => ['id', 'role', 'url']]]);

    $this->assertDatabaseHas('media', [
        'textile_collection_id' => $collection->id,
        'role' => 'proof',
    ]);
});

it('allows up to 3 proof photos but rejects a 4th', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);
    $staff = signInDrLinenStaffPhoto();

    for ($i = 0; $i < 3; $i++) {
        $file = UploadedFile::fake()->image("proof{$i}.jpg", 200, 200)->size(200);
        $this->postJson(
            "/api/v1/department/textile-collections/{$collection->id}/proof",
            ['photo' => $file],
        )->assertCreated();
    }

    $this->assertDatabaseCount('media', 3);

    // 4th should fail
    $file = UploadedFile::fake()->image('proof3.jpg', 200, 200)->size(200);
    $this->postJson(
        "/api/v1/department/textile-collections/{$collection->id}/proof",
        ['photo' => $file],
    )->assertUnprocessable()
        ->assertJsonPath('message', 'Maximum 3 proof photos per collection reached; upload rejected.');
});

it('returns 403 when citizen tries to upload a proof photo', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);

    Sanctum::actingAs($citizen);
    $file = UploadedFile::fake()->image('proof.jpg', 200, 200)->size(200);

    $this->postJson(
        "/api/v1/department/textile-collections/{$collection->id}/proof",
        ['photo' => $file],
    )->assertForbidden();
});

// --- recordOutcome proof validation tests ---

it('returns 422 PROOF_PHOTO_REQUIRED when recording collected without a proof photo', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);
    $staff = signInDrLinenStaffPhoto();

    // Approve + schedule the collection
    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/approve")->assertOk();

    $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$collection->id],
        'collection_date' => now()->addDay()->toDateString(),
    ])->assertCreated();

    // Try to record collected without proof photo
    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/outcome", [
        'outcome' => 'collected',
        'actual_bags' => 3,
        'actual_weight_kg' => 8.2,
    ])->assertUnprocessable()
        ->assertJsonPath('code', 'PROOF_PHOTO_REQUIRED');
});

it('allows recording collected after a proof photo is attached', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);
    $staff = signInDrLinenStaffPhoto();

    // Approve + schedule
    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/approve")->assertOk();

    $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$collection->id],
        'collection_date' => now()->addDay()->toDateString(),
    ])->assertCreated();

    // Attach proof photo first
    attachProofPhoto($collection, $staff);

    // Now record collected — should succeed
    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/outcome", [
        'outcome' => 'collected',
        'actual_bags' => 3,
        'actual_weight_kg' => 8.2,
    ])->assertOk()
        ->assertJsonPath('data.status', 'picked_up');
});

// --- Photos array in show response ---

it('includes photos array in citizen show response', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);

    Sanctum::actingAs($citizen);

    // Initially empty
    $response = $this->getJson("/api/v1/citizen/textile-collections/{$collection->id}");
    $response->assertOk()
        ->assertJsonPath('data.photos', []);

    // Upload a photo
    $file = UploadedFile::fake()->image('photo.jpg', 200, 200)->size(200);
    $this->postJson(
        "/api/v1/citizen/textile-collections/{$collection->id}/photo",
        ['photo' => $file],
    )->assertCreated();

    // Show should now include the photo
    $response = $this->getJson("/api/v1/citizen/textile-collections/{$collection->id}");
    $response->assertOk()
        ->assertJsonCount(1, 'data.photos')
        ->assertJsonPath('data.photos.0.role', 'evidence');
});

it('includes photos array in staff show response', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZonePhoto();
    $collection = createTextileRequestPhoto($citizen, $zone);
    $staff = signInDrLinenStaffPhoto();

    // Attach a proof photo
    attachProofPhoto($collection, $staff);

    $response = $this->getJson("/api/v1/department/textile-collections/{$collection->id}");
    $response->assertOk()
        ->assertJsonCount(1, 'data.photos')
        ->assertJsonPath('data.photos.0.role', 'proof');
});
