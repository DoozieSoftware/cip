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
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

function tripZone(): TextileServiceZone
{
    $dept = Department::query()->where('code', 'DR_LINEN')->firstOrFail();
    return TextileServiceZone::query()->create([
        'code' => 'DRL-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Trip Zone',
        'department_id' => $dept->id,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ]);
}

// ---- Trip assignment (Phase 2) — all blocked by D-05/D-04 ----

it('BE-A1 [OPEN D-05] trip assign happy: assign driver+vehicle to batch → batch updated, audit textile.assign')->todo();
it('BE-A2 [OPEN D-05] trip assign authz neg: non-partner staff 403; driver cannot self-assign; citizen 403')->todo();
it('BE-A3 [OPEN D-05] trip assign idempotency: same Idempotency-Key twice → one audit row')->todo();
it('BE-A4 [OPEN D-05] trip assign lost-update: concurrent assign v1 vs v2 → one 409/422')->todo();

// ---- Stop reorder (Phase 2) — blocked by D-06 ----

it('BE-O1 [OPEN D-06] reorder happy: stop order persists; manifest read returns order')->todo();
it('BE-O2 [OPEN D-06] reorder authz neg: driver from other trip/partner →403')->todo();
it('BE-O3 [OPEN D-06] reorder idempotency: resubmit identical order → stable, no dup audit churn')->todo();
it('BE-O4 [OPEN D-06] reorder lost-update: two staff reorder same trip → stale submit 409')->todo();

// ---- Smoke: current batch/trip routes are absent (keeps green) ----

it('trip execution routes are not yet shipped → 404 or 401', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $this->postJson('/api/v1/department/textile-batches/fake-id/assignment', [
        'assigned_user_id' => $user->id,
    ])->assertStatus(404);
    $this->putJson('/api/v1/department/textile-batches/fake-id/stops/order', [
        'order' => [],
    ])->assertStatus(404);
});
