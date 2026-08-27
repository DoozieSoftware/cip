<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
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
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

function rescheduleZone(array $overrides = []): TextileServiceZone
{
    $drLinenId = Department::query()->where('code', 'DR_LINEN')->value('id');
    return TextileServiceZone::query()->create(array_merge([
        'code' => 'DRL-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Reschedule Zone',
        'department_id' => $drLinenId,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ], $overrides));
}

function reschedulePayload(TextileServiceZone $zone, array $overrides = []): array
{
    return array_merge([
        'title' => 'Reschedule pickup',
        'service_zone_id' => $zone->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '12, MG Road, Bengaluru 560001',
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
    ], $overrides);
}

function createRescheduleRequest(User $citizen, TextileServiceZone $zone, array $overrides = []): TextileCollectionRequest
{
    Sanctum::actingAs($citizen);
    $res = test()->postJson('/api/v1/textile-collection/requests', reschedulePayload($zone, $overrides));
    $res->assertCreated();
    return TextileCollectionRequest::query()->findOrFail($res->json('data.id'));
}

function reschedulePartnerStaff(): User
{
    $staff = User::factory()->create();
    $dept = Department::query()->where('code', 'DR_LINEN')->firstOrFail();
    $staff->departments()->attach($dept->id, ['active' => true]);
    return $staff;
}

function otherReschedulePartnerStaff(): User
{
    $dept = Department::query()->where('code', '!=', 'DR_LINEN')->first();
    if (! $dept) {
        $dept = Department::factory()->create(['code' => 'DEMO_EWASTE', 'name' => 'Demo Ewaste']);
    }
    $staff = User::factory()->create();
    $staff->departments()->attach($dept->id, ['active' => true]);
    return $staff;
}

function scheduleForReschedule(TextileServiceZone $zone, TextileCollectionRequest $req, ?string $date = null): TextileCollectionBatch
{
    $staff = reschedulePartnerStaff();
    Sanctum::actingAs($staff);
    test()->postJson("/api/v1/department/textile-collections/{$req->id}/approve")->assertOk();
    $sched = test()->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$req->id],
        'collection_date' => $date ?? Carbon::tomorrow()->toDateString(),
        'window_start' => '09:00',
        'window_end' => '12:00',
    ])->assertCreated();
    return TextileCollectionBatch::query()->findOrFail($sched->json('data.id'));
}

// ── Phase 3 §6: citizen self-service — contract + findings tests ──────────
// The citizen reschedule endpoint is not yet shipped (no D-04 decision on cutoff
// window/override role). These baseline tests document the contract and keep
// green until the lane ships, at which point the 404 branch is replaced by the
// happy-path guards below.

it('BE-X5 baseline: citizen reschedule endpoint is not yet shipped → 404 shapes contract for Phase 3', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    // Try approve + schedule so request is in scheduled state
    scheduleForReschedule($zone, $req);
    $req->refresh();
    expect($req->status)->toBe(TextileCollectionRequest::STATUS_SCHEDULED);

    Sanctum::actingAs($citizen);
    $attempt = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(2)->toDateString(),
        'window_start' => '14:00',
        'window_end' => '17:00',
    ]);
    // Before Phase 3 ships the lane, the route does not exist.
    expect($attempt->status())->toBe(404);
});

it('BE-X5 baseline: unauthenticated reschedule attempt is 401 not 404 leak', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    $reqId = $req->id;
    // No actingAs → unauthenticated
    \Laravel\Sanctum\Sanctum::actingAs(null);
    // Clear auth: Pest's Sanctum helper needs explicit logout
    $this->postJson("/api/v1/citizen/textile-collections/{$reqId}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDay()->toDateString(),
    ])->assertStatus(401);
});

it('BE-X5 baseline: other citizen cannot reschedule another citizen request → 404 or 403 after lane ships', function (): void {
    $owner = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($owner, $zone);
    scheduleForReschedule($zone, $req);
    $intruder = User::factory()->create();
    Sanctum::actingAs($intruder);
    $res = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(3)->toDateString(),
    ]);
    // Either 404 (route not shipped) or 403 (lane ships but ownership guard fires) is acceptable until strict.
    expect($res->status())->toBeIn([404, 403]);
});

it('BE-X5 baseline: reschedule does not yet create duplicate active bookings — count stays 1', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    scheduleForReschedule($zone, $req);
    Sanctum::actingAs($citizen);
    // Attempt repeated reschedule — both 404 today, so no duplicate row could be created.
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(2)->toDateString(),
    ]);
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(3)->toDateString(),
    ]);
    // Citizen should still have exactly one active collection request.
    $activeCount = TextileCollectionRequest::query()
        ->where('citizen_id', $citizen->id)
        ->whereNotIn('status', [TextileCollectionRequest::STATUS_CANCELLED, TextileCollectionRequest::STATUS_REJECTED, TextileCollectionRequest::STATUS_PICKED_UP])
        ->count();
    expect($activeCount)->toBe(1);
});

// ── OPEN D-04 — cutoff + override (require product decisions) ──────────────

it('BE-X5-RS1 [OPEN D-04] reschedule happy: scheduled premises before cutoff → new date, old batch reconciled, audit shows old+new')->todo();
it('BE-X5-RS2 [OPEN D-04] reschedule cutoff: within cutoff window → 422 RESCHEDULE_CUTOFF_PASSED with cutoff hint')->todo();
it('BE-X5-RS3 [OPEN D-04] partner override after cutoff succeeds with audit textile.reschedule_override')->todo();
it('BE-X5-RS4 [OPEN D-04] freeze when trip in_progress → citizen reschedule 422 TRIP_ALREADY_STARTED; partner override path pending D-04 role')->todo();
it('BE-X5-RS5 [OPEN D-04] atomic reconciliation: old assignment removed and new schedule created atomically, no orphan batch membership')->todo();
it('BE-X5-RS6 [OPEN D-04] idempotent reschedule: same Idempotency-Key replay → single audit, single history entry')->todo();
it('BE-X5-RS7 [OPEN D-04] concurrent reschedule ∥ collect → exactly one terminal state, other 409/422')->todo();

// ── Cutoff / unavailable slot presentation ──────────────────────────────────

it('BE-X5-RS8 [OPEN D-04] unavailable dates/windows returned instead of accepting impossible slot → 422 SLOT_UNAVAILABLE with fallback')->todo();
it('BE-X5-RS9 [OPEN D-04] requested slot no longer available shows clear fallback reason visible to partner (audit before/after)')->todo();

// ── Duplicate protection + history ──────────────────────────────────────────

it('BE-X5-RS10 duplicate active bookings forbidden: repeated reschedule keeps single active row, history retains old+new schedule')->todo();
it('BE-X5-RS11 history/audit: old and new scheduled_date / batch_id / window visible in AuditLog + timeline')->todo();

// ── Readiness / contact instructions (permitted edit without evidence rewrite) ──

it('BE-X5-RS12 [OPEN D-04] citizen can update readiness_instructions / contact before cutoff without rewriting proof evidence')->todo();
it('BE-X5-RS13 readiness update after cutoff → 422; partner override → 200 with audit')->todo();

// ── Reminders — §6 "proactive communication" ────────────────────────────────

it('BE-N-RS1 [OPEN D-04] reminder: scheduled premises receives reminder before trip date (once)')->todo();
it('BE-N-RS2 reminder never sent for cancelled, rejected, or already-collected request')->todo();
it('BE-N-RS3 [OPEN] reminder respects notification preferences / consent / rate limits and delivery failure handling')->todo();
it('BE-N-RS4 [OPEN] on-the-way / arrival-window update when trip execution begins is partner-controlled and does not leak staff PII')->todo();

// ── AuthZ + exposure guardrails that stay green today ───────────────────────

it('BE-X5 guardrail: staff personal phone is never exposed in citizen reschedule context', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    scheduleForReschedule($zone, $req);
    Sanctum::actingAs($citizen);
    $res = $this->getJson("/api/v1/citizen/textile-collections/{$req->id}");
    $res->assertOk();
    $body = (string) $res->getContent();
    // No staff phone should be present in citizen view.
    expect($body)->not->toContain('assigned_user_phone')
        ->and($body)->not->toContain('driver_phone');
});

it('BE-X5 guardrail: cross-partner staff cannot reschedule another partner request → 403 or 404 after lane ships', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    scheduleForReschedule($zone, $req);
    $other = otherReschedulePartnerStaff();
    Sanctum::actingAs($other);
    $attempt = $this->postJson("/api/v1/department/textile-collections/{$req->id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(5)->toDateString(),
    ]);
    // Before lane ships: department reschedule route does not exist → 404. After: 403 for other partner.
    expect($attempt->status())->toBeIn([404, 403, 405]);
});

it('BE-X5 guardrail: notification suppression baseline — cancelled request has no scheduled reminder side-effect', function (): void {
    Notification::fake();
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    $req = createRescheduleRequest($citizen, $zone);
    Sanctum::actingAs($citizen);
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/cancel", [
        'reason' => 'No longer needed for reminder suppression test.',
    ])->assertOk();
    expect($req->refresh()->status)->toBe(TextileCollectionRequest::STATUS_CANCELLED);
    // No notification about collection scheduling should have been dispatched for a cancelled request.
    // Current engine does not dispatch reminders yet; this stays green and documents the Phase 3 invariant.
    Notification::assertNothingSent();
});

// ── Zone unavailable / dropoff vs premises lane guard ───────────────────────

it('BE-X5 lane guard: dropoff request cannot be rescheduled as a doorstep pickup slot', function (): void {
    $citizen = User::factory()->create();
    $zone = rescheduleZone();
    Sanctum::actingAs($citizen);
    $r = $this->postJson('/api/v1/textile-collection/requests', reschedulePayload($zone, [
        'collection_method' => 'dropoff',
    ]))->assertCreated();
    $id = $r->json('data.id');
    $staff = reschedulePartnerStaff();
    Sanctum::actingAs($staff);
    $this->postJson("/api/v1/department/textile-collections/{$id}/approve")->assertOk();
    Sanctum::actingAs($citizen);
    $res = $this->postJson("/api/v1/citizen/textile-collections/{$id}/reschedule", [
        'collection_date' => Carbon::tomorrow()->addDays(2)->toDateString(),
    ]);
    // Before lane ships: 404. After: should be 422 (dropoff not in trip lane).
    expect($res->status())->toBeIn([404, 422]);
});
