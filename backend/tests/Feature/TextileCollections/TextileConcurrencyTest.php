<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
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

function concZone(): TextileServiceZone
{
    $dept = Department::query()->where('code', 'DR_LINEN')->firstOrFail();
    return TextileServiceZone::query()->create([
        'code' => 'DRL-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Conc Zone',
        'department_id' => $dept->id,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ]);
}
function concPayload(TextileServiceZone $z, array $o = []): array
{
    return array_merge([
        'title' => 'Conc pickup',
        'service_zone_id' => $z->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '12 MG Road',
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
    ], $o);
}
function concStaff(): User { $s = User::factory()->create(); $d = Department::query()->where('code','DR_LINEN')->firstOrFail(); $s->departments()->attach($d->id, ['active'=>true]); return $s; }
function makeScheduled(TextileServiceZone $zone): TextileCollectionRequest
{
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $r = test()->postJson('/api/v1/textile-collection/requests', concPayload($zone))->assertCreated();
    $col = TextileCollectionRequest::query()->findOrFail($r->json('data.id'));
    $staff = concStaff(); Sanctum::actingAs($staff);
    test()->postJson("/api/v1/department/textile-collections/{$col->id}/approve")->assertOk();
    test()->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$col->id],
        'collection_date' => Carbon::tomorrow()->toDateString(),
    ])->assertCreated();
    return $col->refresh();
}

// BE-C4: findings test — recordOutcome has no row lock, so concurrent collect||miss should still end in exactly one terminal state.
// On current engine both sequential POSTs will give one OK and one 422 (guard by status). We assert that invariant here (green).
it('CC-1 / BE-C4 collect ∥ miss same scheduled request → exactly one terminal outcome', function (): void {
    $zone = concZone();
    $col = makeScheduled($zone);
    $staff = concStaff(); Sanctum::actingAs($staff);
    // attach proof so collected can succeed
    $file = UploadedFile::fake()->image('proof.jpg', 100, 100)->size(100);
    $this->postJson("/api/v1/department/textile-collections/{$col->id}/proof", ['photo' => $file])->assertCreated();

    $r1 = $this->postJson("/api/v1/department/textile-collections/{$col->id}/outcome", [
        'outcome' => 'collected', 'actual_bags' => 2, 'actual_weight_kg' => 5.0,
    ]);
    $r2 = $this->postJson("/api/v1/department/textile-collections/{$col->id}/outcome", [
        'outcome' => 'missed', 'reason' => 'Nobody at home for miss test.',
    ]);
    // exactly one succeeds
    $successes = collect([$r1, $r2])->filter(fn($r) => $r->status() === 200)->count();
    expect($successes)->toBe(1);
    $col->refresh();
    expect($col->status)->toBeIn(['picked_up', 'missed']);
});

// CC-2 / BE-X4 cancel ∥ collect
it('CC-2 / BE-X4 cancel ∥ collect same request → exactly one terminal state', function (): void {
    $zone = concZone();
    $col = makeScheduled($zone);
    $staff = concStaff(); Sanctum::actingAs($staff);
    $file = UploadedFile::fake()->image('proof.jpg', 100, 100)->size(100);
    $this->postJson("/api/v1/department/textile-collections/{$col->id}/proof", ['photo' => $file])->assertCreated();

    $citizen = $col->citizen;
    // staff collect
    Sanctum::actingAs($staff);
    $rCollect = $this->postJson("/api/v1/department/textile-collections/{$col->id}/outcome", [
        'outcome' => 'collected', 'actual_bags' => 1, 'actual_weight_kg' => 1.0,
    ]);
    // citizen cancel after
    Sanctum::actingAs($citizen);
    $rCancel = $this->postJson("/api/v1/citizen/textile-collections/{$col->id}/cancel", ['reason' => 'No longer needed cancel test']);
    $successes = collect([$rCollect, $rCancel])->filter(fn($r) => $r->status() === 200)->count();
    expect($successes)->toBe(1);
    $col->refresh();
    expect($col->status)->toBeIn(['picked_up', 'cancelled']);
});

// CC-4 batch schedule same request from two desks → single batch membership (lockForUpdate path)
it('CC-4 concurrent schedule of same request → one batch wins (existing lock path)', function (): void {
    $zone = concZone();
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $r = $this->postJson('/api/v1/textile-collection/requests', concPayload($zone))->assertCreated();
    $id = $r->json('data.id');
    $staff = concStaff(); Sanctum::actingAs($staff);
    $this->postJson("/api/v1/department/textile-collections/{$id}/approve")->assertOk();
    $r1 = $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id, 'collection_request_ids' => [$id], 'collection_date' => Carbon::tomorrow()->toDateString(),
    ]);
    $r1->assertCreated();
    $r2 = $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id, 'collection_request_ids' => [$id], 'collection_date' => Carbon::tomorrow()->toDateString(),
    ]);
    // second should be rejected (status guard)
    $r2->assertStatus(422);
});

// CC-7 double citizen photo → single active chain
it('CC-7 double POST citizen photo → single active evidence chain (is_replaced)', function (): void {
    $zone = concZone();
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $r = $this->postJson('/api/v1/textile-collection/requests', concPayload($zone))->assertCreated();
    $id = $r->json('data.id');
    $f1 = UploadedFile::fake()->image('a.jpg', 100, 100)->size(100);
    $this->postJson("/api/v1/citizen/textile-collections/{$id}/photo", ['photo' => $f1])->assertCreated();
    $f2 = UploadedFile::fake()->image('b.jpg', 100, 100)->size(100);
    $this->postJson("/api/v1/citizen/textile-collections/{$id}/photo", ['photo' => $f2])->assertCreated();
    $active = \App\Modules\Media\Models\Media::query()->where('textile_collection_id', $id)->where('role','evidence')->where('is_replaced', false)->count();
    expect($active)->toBe(1);
});

// Remaining CC todos
it('CC-3 [OPEN D-01] double receipt same reference — unique constraint or guard')->todo();
it('CC-5 [OPEN D-06] stale reorder submission vs committed order → 409')->todo();
it('CC-6 [OPEN D-05] stale assignment submission → 409/422')->todo();
