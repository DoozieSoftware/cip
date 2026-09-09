<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileDropoffCentre;
use App\Modules\TextileCollections\Models\TextilePartnerCapability;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

// ── Helpers (centre prefix to avoid global collision) ──────────────────

function centreEnsurePartner(string $code, string $category = 'clothes_waste'): Department
{
    $dept = Department::query()->where('code', $code)->first();

    if (! $dept instanceof Department) {
        $dept = Department::factory()->create([
            'code' => $code,
            'name' => $code.' Partner',
            'active' => true,
        ]);
    }

    TextilePartnerCapability::query()->updateOrCreate(
        ['department_id' => $dept->id, 'category' => $category],
    );

    return $dept;
}

function centreZone(Department $dept, array $overrides = []): TextileServiceZone
{
    return TextileServiceZone::query()->create(array_merge([
        'code' => 'CTR-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Centre Zone '.$dept->code,
        'department_id' => $dept->id,
        'center_latitude' => 12.9716,
        'center_longitude' => 77.5946,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ], $overrides));
}

function centreStaff(Department $dept): User
{
    $staff = User::factory()->create();
    $staff->departments()->attach($dept->id, ['active' => true]);

    return $staff;
}

function centreRow(TextileServiceZone $zone, array $overrides = []): TextileDropoffCentre
{
    return TextileDropoffCentre::query()->create(array_merge([
        'service_zone_id' => $zone->id,
        'name' => 'Main centre',
        'address' => '1, Main Road',
        'status' => TextileDropoffCentre::STATUS_OPEN,
        'active' => true,
        'sort_order' => 0,
    ], $overrides));
}

function centreBookingPayload(TextileServiceZone $zone, array $overrides = []): array
{
    return array_merge([
        'title' => 'Centre drop-off',
        'service_zone_id' => $zone->id,
        'requester_type' => 'individual',
        'requester_name' => 'Meera Nair',
        'contact_email' => 'meera-ctr@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '45, Residency Road, Bengaluru 560025',
        'collection_method' => 'dropoff',
        'estimated_bags' => 2,
        'category' => 'clothes_waste',
    ], $overrides);
}

// ── Staff zone management ──────────────────────────────────────────────

it('partner staff can create a zone and it is audited', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    Sanctum::actingAs(centreStaff($dept));

    $res = $this->postJson('/api/v1/department/textile-zones', [
        'code' => 'CTR-NEW-ZONE',
        'name' => 'New Zone',
    ]);

    $res->assertCreated()->assertJsonPath('data.code', 'CTR-NEW-ZONE');

    $zoneId = $res->json('data.id');
    $this->assertDatabaseHas('textile_service_zones', [
        'id' => $zoneId,
        'department_id' => $dept->id,
    ]);

    expect(AuditLog::query()->where('entity', 'textile_service_zone')->where('entity_id', $zoneId)->where('action', 'textile.zone_created')->exists())->toBeTrue();
});

it('partner staff see only their own zones in the staff list', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $other = centreEnsurePartner('OTHER_CTR');
    $own = centreZone($dept);
    centreZone($other);
    Sanctum::actingAs(centreStaff($dept));

    $res = $this->getJson('/api/v1/department/textile-zones');

    $res->assertOk();
    $ids = collect($res->json('data'))->pluck('id')->all();
    expect($ids)->toContain($own->id);
    expect($res->json('data'))->toHaveCount(1);
});

it('non-partner staff cannot create zones', function (): void {
    $plain = Department::factory()->create(['code' => 'PLAIN_CTR', 'name' => 'Plain', 'active' => true]);
    $staff = User::factory()->create();
    $staff->departments()->attach($plain->id, ['active' => true]);
    Sanctum::actingAs($staff);

    $this->postJson('/api/v1/department/textile-zones', [
        'code' => 'CTR-NOPE',
        'name' => 'Nope',
    ])->assertForbidden();
});

// ── Staff centre management + partner isolation ────────────────────────

it('partner staff can create, list and update centres with audit', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    Sanctum::actingAs(centreStaff($dept));

    $created = $this->postJson("/api/v1/department/textile-zones/{$zone->id}/centres", [
        'name' => 'North centre',
        'address' => '9, North Street',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ]);

    $created->assertCreated()->assertJsonPath('data.name', 'North centre');
    $centreId = $created->json('data.id');

    $this->getJson("/api/v1/department/textile-zones/{$zone->id}/centres")
        ->assertOk()
        ->assertJsonPath('data.0.id', $centreId);

    $this->putJson("/api/v1/department/textile-dropoff-centres/{$centreId}", [
        'status' => TextileDropoffCentre::STATUS_TEMPORARILY_CLOSED,
        'closed_note' => 'Renovation this week.',
    ])->assertOk()->assertJsonPath('data.status', TextileDropoffCentre::STATUS_TEMPORARILY_CLOSED);

    expect(AuditLog::query()->where('entity', 'textile_dropoff_centre')->where('entity_id', $centreId)->where('action', 'textile.centre_created')->exists())->toBeTrue();
    expect(AuditLog::query()->where('entity', 'textile_dropoff_centre')->where('entity_id', $centreId)->where('action', 'textile.centre_updated')->exists())->toBeTrue();
});

it('partner staff cannot manage another partner zone centres', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $other = centreEnsurePartner('OTHER_CTR');
    $otherZone = centreZone($other);
    $otherCentre = centreRow($otherZone);
    Sanctum::actingAs(centreStaff($dept));

    $this->postJson("/api/v1/department/textile-zones/{$otherZone->id}/centres", [
        'name' => 'Intruder centre',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ])->assertForbidden();

    $this->getJson("/api/v1/department/textile-zones/{$otherZone->id}/centres")->assertForbidden();

    $this->putJson("/api/v1/department/textile-dropoff-centres/{$otherCentre->id}", [
        'name' => 'Hijacked',
    ])->assertForbidden();
});

// ── Citizen booking with centre dropdown ───────────────────────────────

it('citizen zones list embeds active centres for the dropdown', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    $open = centreRow($zone, ['name' => 'Open centre']);
    $hidden = centreRow($zone, ['name' => 'Hidden centre', 'active' => false]);
    Sanctum::actingAs(User::factory()->create());

    $res = $this->getJson('/api/v1/textile-collection/zones');

    $res->assertOk();
    $row = collect($res->json('data'))->firstWhere('id', $zone->id);
    expect($row)->not->toBeNull();
    $centreIds = collect($row['centres'])->pluck('id')->all();
    expect($centreIds)->toContain($open->id)->and($centreIds)->not->toContain($hidden->id);
});

it('citizen can book a drop-off at a chosen centre', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    $centre = centreRow($zone);
    Sanctum::actingAs(User::factory()->create());

    $res = $this->postJson('/api/v1/textile-collection/requests', centreBookingPayload($zone, [
        'dropoff_centre_id' => $centre->id,
    ]));

    $res->assertCreated()->assertJsonPath('data.dropoff_centre.id', $centre->id);

    $this->assertDatabaseHas('textile_collection_requests', [
        'id' => $res->json('data.id'),
        'dropoff_centre_id' => $centre->id,
    ]);
});

it('citizen booking rejects a centre from another zone', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    $otherZone = centreZone($dept);
    $foreign = centreRow($otherZone);
    Sanctum::actingAs(User::factory()->create());

    $res = $this->postJson('/api/v1/textile-collection/requests', centreBookingPayload($zone, [
        'dropoff_centre_id' => $foreign->id,
    ]));

    $res->assertStatus(422);
});

it('citizen booking rejects a closed centre', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    $closed = centreRow($zone, ['status' => TextileDropoffCentre::STATUS_TEMPORARILY_CLOSED]);
    Sanctum::actingAs(User::factory()->create());

    $this->postJson('/api/v1/textile-collection/requests', centreBookingPayload($zone, [
        'dropoff_centre_id' => $closed->id,
    ]))->assertStatus(422);
});

it('citizen booking without a centre still works', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    Sanctum::actingAs(User::factory()->create());

    $res = $this->postJson('/api/v1/textile-collection/requests', centreBookingPayload($zone));

    $res->assertCreated();
    expect($res->json('data.dropoff_centre'))->toBeNull();
    expect(TextileCollectionRequest::query()->findOrFail($res->json('data.id'))->dropoff_centre_id)->toBeNull();
});

it('partner staff can pin a centre location on the map', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    Sanctum::actingAs(centreStaff($dept));

    $created = $this->postJson("/api/v1/department/textile-zones/{$zone->id}/centres", [
        'name' => 'Pinned centre',
        'address' => '9, North Street',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ]);

    $created->assertCreated()
        ->assertJsonPath('data.latitude', 12.9716)
        ->assertJsonPath('data.longitude', 77.5946);

    $centreId = $created->json('data.id');

    $this->putJson("/api/v1/department/textile-dropoff-centres/{$centreId}", [
        'latitude' => 13.0358,
        'longitude' => 77.597,
    ])->assertOk()->assertJsonPath('data.latitude', 13.0358);

    $this->assertDatabaseHas('textile_dropoff_centres', [
        'id' => $centreId,
        'latitude' => 13.0358,
    ]);

    $this->putJson("/api/v1/department/textile-dropoff-centres/{$centreId}", [
        'latitude' => 200,
    ])->assertStatus(422);
});

it('requires a map location when staff create a centre', function (): void {
    $dept = centreEnsurePartner('DR_LINEN');
    $zone = centreZone($dept);
    Sanctum::actingAs(centreStaff($dept));

    $this->postJson("/api/v1/department/textile-zones/{$zone->id}/centres", [
        'name' => 'Unpinned centre',
        'address' => '9, North Street',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['latitude', 'longitude']);
});
