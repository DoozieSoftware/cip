<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportType;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

function textileZone(array $overrides = []): TextileServiceZone
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

/** @return array<string, mixed> */
function textilePayload(TextileServiceZone $zone, array $overrides = []): array
{
    return array_merge([
        'title' => 'Household clothes collection',
        'notes' => 'Three bags of clean clothes and bedsheets.',
        'service_zone_id' => $zone->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '12, MG Road, Bengaluru 560001',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
    ], $overrides);
}

function createTextileRequest(User $citizen, TextileServiceZone $zone): TextileCollectionRequest
{
    Sanctum::actingAs($citizen);
    $response = test()->postJson('/api/v1/textile-collection/requests', textilePayload($zone));
    $response->assertCreated();

    return TextileCollectionRequest::query()->findOrFail($response->json('data.id'));
}

function signInDrLinenStaff(): User
{
    $staff = User::factory()->create();
    $department = Department::query()->where('code', 'DR_LINEN')->firstOrFail();
    $staff->departments()->attach($department->id, ['active' => true]);
    Sanctum::actingAs($staff);

    return $staff;
}

it('creates a standalone textile pickup without creating a complaint', function (): void {
    $citizen = User::factory()->create();
    $zone = textileZone();
    Sanctum::actingAs($citizen);

    $response = $this->postJson('/api/v1/textile-collection/requests', textilePayload($zone));

    $response->assertCreated()
        ->assertJsonPath('data.status', 'pending_review')
        ->assertJsonPath('data.service_zone.id', $zone->id);

    $this->assertDatabaseHas('textile_collection_requests', [
        'citizen_id' => $citizen->id,
        'report_id' => null,
        'status' => 'pending_review',
    ]);
    $this->assertDatabaseCount('reports', 0);
});

it('keeps clothes collection out of the complaint submission API', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->where('code', 'clothes_waste')->firstOrFail();

    expect($type->active)->toBeFalse();

    $this->postJson('/api/v1/reports', [
        'report_type_id' => $type->id,
        'title' => 'Collect old clothes',
        'description' => 'This must use the dedicated partner service.',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['report_type_id']);
});

it('lets Dr. Linen review group schedule and complete a pickup', function (): void {
    $zone = textileZone();
    $collection = createTextileRequest(User::factory()->create(), $zone);
    signInDrLinenStaff();

    $this->getJson('/api/v1/department/textile-collections')
        ->assertOk()
        ->assertJsonPath('data.0.reference', $collection->reference);

    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'ready_to_group');

    $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$collection->id],
        'collection_date' => Carbon::tomorrow()->toDateString(),
        'window_start' => '09:00',
        'window_end' => '12:00',
    ])->assertCreated();

    // Attach a proof photo before recording collected (required).
    $proofFile = UploadedFile::fake()->image('proof.jpg', 100, 100)->size(100);
    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/proof", [
        'photo' => $proofFile,
    ])->assertCreated();

    $this->postJson("/api/v1/department/textile-collections/{$collection->id}/outcome", [
        'outcome' => 'collected',
        'actual_bags' => 3,
        'actual_weight_kg' => 8.2,
    ])->assertOk()
        ->assertJsonPath('data.status', 'picked_up');

    $this->assertDatabaseHas('textile_collection_requests', [
        'id' => $collection->id,
        'status' => 'picked_up',
        'actual_bags' => 3,
    ]);
});

it('allows only the owning citizen to cancel a pickup', function (): void {
    $owner = User::factory()->create();
    $collection = createTextileRequest($owner, textileZone());

    Sanctum::actingAs(User::factory()->create());
    $this->postJson("/api/v1/citizen/textile-collections/{$collection->id}/cancel", [
        'reason' => 'This belongs to another citizen.',
    ])->assertForbidden();

    Sanctum::actingAs($owner);
    $this->postJson("/api/v1/citizen/textile-collections/{$collection->id}/cancel", [
        'reason' => 'The clothes were donated elsewhere.',
    ])->assertOk()
        ->assertJsonPath('data.status', 'cancelled');
});
