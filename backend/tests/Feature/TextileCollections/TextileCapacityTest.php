<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileCapacityException;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextilePartnerCapability;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

// ── Helpers (capacity prefix to avoid global collision) ────────────────

function capacityEnsurePartner(string $code, string $category = 'clothes_waste'): Department
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

    // Ensure every category that tests use is available for DR_LINEN
    if ($code === 'DR_LINEN') {
        foreach (['clothes_waste', 'metal_scrap', 'e_waste'] as $cat) {
            TextilePartnerCapability::query()->updateOrCreate(
                ['department_id' => $dept->id, 'category' => $cat],
            );
        }
    }

    return $dept;
}

function capacityZone(Department $dept, array $overrides = []): TextileServiceZone
{
    return TextileServiceZone::query()->create(array_merge([
        'code' => 'CAP-'.strtoupper(substr(uniqid(), -8)),
        'name' => 'Capacity Zone '.$dept->code,
        'department_id' => $dept->id,
        'center_latitude' => 12.9716,
        'center_longitude' => 77.5946,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ], $overrides));
}

function capacityStaff(Department $dept): User
{
    $staff = User::factory()->create();
    $staff->departments()->attach($dept->id, ['active' => true]);

    return $staff;
}

function capacityCitizen(): User
{
    return User::factory()->create();
}

function capacityPayload(TextileServiceZone $zone, array $overrides = []): array
{
    return array_merge([
        'title' => 'Capacity pickup',
        'service_zone_id' => $zone->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha-cap@example.com',
        'contact_phone' => '+91 9876543210',
        'pickup_address' => '12, MG Road, Bengaluru 560001',
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
        'category' => 'clothes_waste',
    ], $overrides);
}

function capacityCreateRequest(User $citizen, TextileServiceZone $zone, array $overrides = []): TextileCollectionRequest
{
    Sanctum::actingAs($citizen);
    $res = test()->postJson('/api/v1/textile-collection/requests', capacityPayload($zone, $overrides));
    $res->assertCreated();

    return TextileCollectionRequest::query()->findOrFail($res->json('data.id'));
}

function capacityApproveAndSchedule(TextileServiceZone $zone, TextileCollectionRequest $req, User $staff, string $date): TextileCollectionBatch
{
    Sanctum::actingAs($staff);
    test()->postJson("/api/v1/department/textile-collections/{$req->id}/approve")->assertOk();
    $sched = test()->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$req->id],
        'collection_date' => $date,
        'window_start' => '09:00',
        'window_end' => '12:00',
    ])->assertCreated();

    return TextileCollectionBatch::query()->findOrFail($sched->json('data.id'));
}

function capacityRulePayload(TextileServiceZone $zone, array $overrides = []): array
{
    return array_merge([
        'service_zone_id' => $zone->id,
        'max_bags' => 10,
        'max_weight_kg' => 50.0,
        'max_stops' => 8,
        'min_bags' => 2,
        'min_weight_kg' => 5.0,
        'guidance_text' => 'Keep textiles dry and packed.',
        'category_allowlist' => ['clothes_waste'],
    ], $overrides);
}

// ── Create / list / update / delete capacity rules ─────────────────────

it('partner can create a capacity rule and it is audited', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    Sanctum::actingAs($staff);

    $res = $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone));

    $res->assertCreated()
        ->assertJsonPath('data.service_zone_id', $zone->id)
        ->assertJsonPath('data.max_bags', 10)
        ->assertJsonPath('data.min_bags', 2);

    $ruleId = $res->json('data.id');
    expect($ruleId)->not->toBeNull();

    $this->assertDatabaseHas('textile_capacity_rules', [
        'id' => $ruleId,
        'service_zone_id' => $zone->id,
        'department_id' => $dept->id,
        'max_bags' => 10,
    ]);

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $ruleId)->where('action', 'textile.capacity_rule_created')->exists())->toBeTrue();
});

it('partner can list capacity rules and filter by zone', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zoneA = capacityZone($dept);
    $zoneB = capacityZone($dept);
    $staff = capacityStaff($dept);
    Sanctum::actingAs($staff);

    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zoneA, ['max_bags' => 10]))->assertCreated();
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zoneB, ['max_bags' => 20]))->assertCreated();

    $all = $this->getJson('/api/v1/department/textile-capacity/rules')->assertOk()->json('data');
    expect(count($all))->toBe(2);

    $filtered = $this->getJson('/api/v1/department/textile-capacity/rules?service_zone_id='.$zoneA->id)->assertOk()->json('data');
    expect(count($filtered))->toBe(1)
        ->and($filtered[0]['service_zone_id'])->toBe($zoneA->id);
});

it('partner can update a capacity rule and it is audited', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    Sanctum::actingAs($staff);

    $ruleId = $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone))->assertCreated()->json('data.id');

    $upd = $this->putJson("/api/v1/department/textile-capacity/rules/{$ruleId}", [
        'max_bags' => 25,
        'guidance_text' => 'Updated guidance for capacity.',
    ])->assertOk();

    $upd->assertJsonPath('data.max_bags', 25)
        ->assertJsonPath('data.guidance_text', 'Updated guidance for capacity.');

    $this->assertDatabaseHas('textile_capacity_rules', [
        'id' => $ruleId,
        'max_bags' => 25,
    ]);

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $ruleId)->where('action', 'textile.capacity_rule_updated')->exists())->toBeTrue();
});

it('partner can delete a capacity rule and it is audited', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    Sanctum::actingAs($staff);

    $ruleId = $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone))->assertCreated()->json('data.id');

    $this->deleteJson("/api/v1/department/textile-capacity/rules/{$ruleId}")->assertStatus(204);
    $this->assertSoftDeleted('textile_capacity_rules', ['id' => $ruleId]);

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $ruleId)->where('action', 'textile.capacity_rule_deleted')->exists())->toBeTrue();
});

// ── Evaluate batch ───────────────────────────────────────────────────────

it('evaluate batch under capacity returns ok true with no blockers', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();

    // Rule allows 10 bags, 50 kg, 8 stops
    Sanctum::actingAs($staff);
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'max_bags' => 10,
        'max_weight_kg' => 50,
        'max_stops' => 8,
        'min_bags' => 1,
    ]))->assertCreated();

    $req = capacityCreateRequest($citizen, $zone, ['estimated_bags' => 3, 'estimated_weight_kg' => 8.0]);
    $batch = capacityApproveAndSchedule($zone, $req, $staff, Carbon::tomorrow()->toDateString());

    Sanctum::actingAs($staff);
    $eval = $this->postJson("/api/v1/department/textile-batches/{$batch->id}/evaluate-capacity")->assertOk()->json('data');

    expect($eval['ok'])->toBeTrue()
        ->and($eval['blockers'])->toBeEmpty()
        ->and($eval['totals']['bags'])->toBe(3)
        ->and($eval['totals']['stops'])->toBe(1)
        ->and($eval['effective_rule'])->not->toBeNull()
        ->and($eval['effective_rule']['max_bags'])->toBe(10);
});

it('evaluate batch over capacity returns blockers and ok false', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);

    Sanctum::actingAs($staff);
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'max_bags' => 5,
        'max_weight_kg' => 10,
        'max_stops' => 2,
        'min_bags' => 1,
    ]))->assertCreated();

    // Two requests that together exceed max_bags (3+3=6 >5)
    $c1 = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 3, 'estimated_weight_kg' => 4.0]);
    $c2 = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 3, 'estimated_weight_kg' => 4.0]);

    Sanctum::actingAs($staff);

    foreach ([$c1, $c2] as $r) {
        $this->postJson("/api/v1/department/textile-collections/{$r->id}/approve")->assertOk();
    }
    $sched = $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$c1->id, $c2->id],
        'collection_date' => Carbon::tomorrow()->toDateString(),
    ])->assertCreated();
    $batch = TextileCollectionBatch::query()->findOrFail($sched->json('data.id'));

    $eval = $this->postJson("/api/v1/department/textile-batches/{$batch->id}/evaluate-capacity")->assertOk()->json('data');

    expect($eval['ok'])->toBeFalse()
        ->and($eval['blockers'])->not->toBeEmpty()
        ->and(collect($eval['blockers'])->pluck('code')->contains('exceeds_max_bags'))->toBeTrue();
});

it('evaluate batch below minimum returns warning with guidance', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);

    Sanctum::actingAs($staff);
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'max_bags' => 20,
        'min_bags' => 5,
        'min_weight_kg' => 10,
        'guidance_text' => 'Please combine with neighbours.',
    ]))->assertCreated();

    $req = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 1, 'estimated_weight_kg' => 2.0]);
    $batch = capacityApproveAndSchedule($zone, $req, $staff, Carbon::tomorrow()->toDateString());

    Sanctum::actingAs($staff);
    $eval = $this->postJson("/api/v1/department/textile-batches/{$batch->id}/evaluate-capacity")->assertOk()->json('data');

    expect($eval['ok'])->toBeTrue()
        ->and($eval['warnings'])->not->toBeEmpty();

    $below = collect($eval['warnings'])->firstWhere('code', 'below_minimum');
    expect($below)->not->toBeNull()
        ->and($below['message'])->toContain('below minimum')
        ->and($below['message'])->toContain('Please combine');
});

it('suggest stops returns ordered list and does not auto-apply', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept, ['center_latitude' => 12.9716, 'center_longitude' => 77.5946]);
    $staff = capacityStaff($dept);

    $r1 = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 2, 'latitude' => 12.9717, 'longitude' => 77.5947]);
    $r2 = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 2, 'latitude' => 13.0, 'longitude' => 77.6]);
    $r3 = capacityCreateRequest(capacityCitizen(), $zone, ['estimated_bags' => 2]);

    Sanctum::actingAs($staff);

    foreach ([$r1, $r2, $r3] as $r) {
        $this->postJson("/api/v1/department/textile-collections/{$r->id}/approve")->assertOk();
    }
    $sched = $this->postJson('/api/v1/department/textile-collections/schedule', [
        'service_zone_id' => $zone->id,
        'collection_request_ids' => [$r1->id, $r2->id, $r3->id],
        'collection_date' => Carbon::tomorrow()->toDateString(),
    ])->assertCreated();
    $batch = TextileCollectionBatch::query()->findOrFail($sched->json('data.id'));

    $res = $this->postJson("/api/v1/department/textile-batches/{$batch->id}/suggest-stops")->assertOk()->json('data');

    expect($res['batch_id'])->toBe($batch->id)
        ->and($res['suggested_order'])->toBeArray()
        ->and(count($res['suggested_order']))->toBe(3)
        ->and($res['current_order'])->toBeArray()
        ->and($res['note'])->toContain('advisory');

    // Ensure all ids present
    expect(collect($res['suggested_order'])->diff([$r1->id, $r2->id, $r3->id])->isEmpty())->toBeTrue();

    // Ordering is advisory only — DB order unchanged (still by created_at / stop_order)
    $current = TextileCollectionRequest::query()->where('batch_id', $batch->id)->orderBy('created_at')->pluck('id')->all();
    expect($res['current_order'])->toBe($current);
});

// ── Citizen capacity minimum guidance ──────────────────────────────────

it('citizen can fetch capacity minimum guidance for a zone', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();

    Sanctum::actingAs($staff);
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'min_bags' => 4,
        'min_weight_kg' => 7.5,
        'guidance_text' => 'Minimum for this zone.',
    ]))->assertCreated();

    Sanctum::actingAs($citizen);
    $res = $this->getJson("/api/v1/textile-collection/zones/{$zone->id}/capacity-minimum")->assertOk()->json('data');

    expect($res['service_zone_id'])->toBe($zone->id)
        ->and($res['min_bags'])->toBe(4)
        ->and((float) $res['min_weight_kg'])->toBe(7.5)
        ->and($res['guidance_text'])->toBe('Minimum for this zone.');
});

it('citizen capacity minimum returns nulls when no rule exists', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    Sanctum::actingAs($citizen);

    $res = $this->getJson("/api/v1/textile-collection/zones/{$zone->id}/capacity-minimum")->assertOk()->json('data');

    expect($res['min_bags'])->toBeNull()
        ->and($res['min_weight_kg'])->toBeNull()
        ->and($res['guidance_text'])->toBeNull();
});

// ── Exception workflow ─────────────────────────────────────────────────

it('citizen can request a capacity exception for own collection', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone, ['estimated_bags' => 1]);

    Sanctum::actingAs($citizen);
    $res = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason_code' => 'below_minimum',
        'reason' => 'Small household but urgent due to travel tomorrow, need pickup.',
    ])->assertCreated();

    $res->assertJsonPath('data.reason_code', 'below_minimum')
        ->assertJsonPath('data.status', 'pending');

    $exceptionId = $res->json('data.id');
    expect($exceptionId)->not->toBeNull();

    $this->assertDatabaseHas('textile_capacity_exceptions', [
        'id' => $exceptionId,
        'collection_request_id' => $req->id,
        'status' => 'pending',
    ]);

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $exceptionId)->where('action', 'textile.capacity_exception_requested')->exists())->toBeTrue();

    // Collection is annotated
    expect($req->refresh()->capacity_exception_id)->toBe($exceptionId);
});

it('partner can request a capacity exception for a collection in its zone', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($staff);
    $res = $this->postJson("/api/v1/department/textile-collections/{$req->id}/capacity-exception", [
        'reason_code' => 'capacity_override',
        'reason' => 'High value donor, override capacity to collect together.',
        'idempotency_key' => (string) Str::uuid(),
    ])->assertCreated();

    $res->assertJsonPath('data.reason_code', 'capacity_override')
        ->assertJsonPath('data.status', 'pending');
});

it('idempotent exception request with same key returns same record', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    $key = (string) Str::uuid();

    Sanctum::actingAs($citizen);
    $first = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Idempotent test with enough length for validation.',
        'idempotency_key' => $key,
    ])->assertCreated()->json('data.id');

    $second = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Idempotent test second attempt different text but same key.',
        'idempotency_key' => $key,
    ])->assertCreated()->json('data.id');

    expect($second)->toBe($first);
    expect(TextileCapacityException::query()->where('idempotency_key', $key)->count())->toBe(1);
});

it('partner can approve an exception and collection context is annotated', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($citizen);
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Need approval for below minimum test case.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($staff);
    $decide = $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'approve',
        'reason' => 'Approved after review, high priority.',
    ])->assertOk();

    $decide->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.decided_reason', 'Approved after review, high priority.');

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $exceptionId)->where('action', 'textile.capacity_exception_approved')->exists())->toBeTrue();

    $exc = TextileCapacityException::query()->findOrFail($exceptionId);
    expect($exc->status)->toBe('approved')
        ->and($exc->decided_by)->toBe($staff->id);

    // Collection context should contain exception_approved_at
    $ctx = $req->refresh()->capacity_context;
    expect(is_array($ctx) && isset($ctx['exception_approved_at']))->toBeTrue();
});

it('partner can reject an exception', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($citizen);
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Requesting exception that will be rejected.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($staff);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'reject',
        'reason' => 'Insufficient justification.',
    ])->assertOk()->assertJsonPath('data.status', 'rejected');

    expect(AuditLog::query()->where('entity', 'textile_capacity')->where('entity_id', $exceptionId)->where('action', 'textile.capacity_exception_rejected')->exists())->toBeTrue();
});

it('decide exception twice is rejected as already decided', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($citizen);
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Will try double decide.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($staff);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'approve',
    ])->assertOk();

    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'reject',
        'reason' => 'Second attempt should fail.',
    ])->assertStatus(422);
});

// ── Authorization isolation ───────────────────────────────────────────

it('other partner cannot manage capacity rules', function (): void {
    $deptA = capacityEnsurePartner('DR_LINEN');
    $deptB = capacityEnsurePartner('OTHER_LINEN', 'clothes_waste');
    // Ensure OTHER_LINEN has its own zone
    $zoneA = capacityZone($deptA);
    $zoneB = capacityZone($deptB);
    $staffA = capacityStaff($deptA);
    $staffB = capacityStaff($deptB);

    // A creates a rule
    Sanctum::actingAs($staffA);
    $ruleId = $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zoneA))->assertCreated()->json('data.id');

    // B tries to update A's rule → 403
    Sanctum::actingAs($staffB);
    $this->putJson("/api/v1/department/textile-capacity/rules/{$ruleId}", ['max_bags' => 99])->assertForbidden();

    // B tries to delete → 403
    $this->deleteJson("/api/v1/department/textile-capacity/rules/{$ruleId}")->assertForbidden();

    // B tries to create rule in A's zone → 403 (zone belongs to another partner)
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zoneA))->assertForbidden();

    // B can create rule in its own zone
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zoneB))->assertCreated();

    // B's list does not contain A's rule
    $listB = $this->getJson('/api/v1/department/textile-capacity/rules')->assertOk()->json('data');
    expect(collect($listB)->pluck('id')->contains($ruleId))->toBeFalse();
});

it('other partner cannot decide an exception from another partner', function (): void {
    $deptA = capacityEnsurePartner('DR_LINEN');
    $deptB = capacityEnsurePartner('OTHER_LINEN2', 'clothes_waste');
    $zoneA = capacityZone($deptA);
    $staffB = capacityStaff($deptB);
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zoneA);

    Sanctum::actingAs($citizen);
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Cross partner decide isolation test.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($staffB);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'approve',
    ])->assertForbidden();
});

it('citizen cannot decide an exception', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    $otherCitizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($citizen);
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Citizen decide forbidden test.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($otherCitizen);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'approve',
    ])->assertForbidden();

    // Even the owner citizen cannot decide
    Sanctum::actingAs($citizen);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'approve',
    ])->assertForbidden();
});

it('citizen cannot manage capacity rules', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/department/textile-capacity/rules')->assertForbidden();
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone))->assertForbidden();
});

it('unauthenticated cannot access capacity endpoints', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $this->getJson('/api/v1/department/textile-capacity/rules')->assertUnauthorized();
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone))->assertUnauthorized();

    // Citizen endpoint requires auth as well
    $citizen = capacityCitizen();
    $req = capacityCreateRequest($citizen, $zone);
    // Clear auth
    Sanctum::actingAs(null);
    // Use a fresh unauthenticated client
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Unauth test.',
    ])->assertUnauthorized();
});

// ── Validation errors ──────────────────────────────────────────────────

it('validation errors on create capacity rule are 422', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);
    Sanctum::actingAs($staff);

    // Missing service_zone_id
    $this->postJson('/api/v1/department/textile-capacity/rules', [
        'max_bags' => 10,
    ])->assertUnprocessable()->assertJsonValidationErrors(['service_zone_id']);

    // Invalid max_bags (0 fails min:1)
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, ['max_bags' => 0]))
        ->assertUnprocessable()->assertJsonValidationErrors(['max_bags']);

    // Invalid day_of_week
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, ['day_of_week' => 9]))
        ->assertUnprocessable()->assertJsonValidationErrors(['day_of_week']);

    // effective_to before effective_from
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'effective_from' => '2026-09-10',
        'effective_to' => '2026-09-01',
    ]))->assertUnprocessable()->assertJsonValidationErrors(['effective_to']);

    // Invalid category_allowlist value
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'category_allowlist' => ['invalid_category'],
    ]))->assertUnprocessable()->assertJsonValidationErrors(['category_allowlist.0']);
});

it('validation errors on exception request and decide are 422', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $citizen = capacityCitizen();
    $staff = capacityStaff($dept);
    $req = capacityCreateRequest($citizen, $zone);

    Sanctum::actingAs($citizen);
    // Missing required reason
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason_code' => 'below_minimum',
    ])->assertUnprocessable()->assertJsonValidationErrors(['reason']);

    // Reason too short (<10)
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Short',
    ])->assertUnprocessable()->assertJsonValidationErrors(['reason']);

    // Invalid reason_code
    $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason_code' => 'not_a_code',
        'reason' => 'Valid length reason for testing invalid code.',
    ])->assertUnprocessable()->assertJsonValidationErrors(['reason_code']);

    // Valid request then invalid decide
    $exceptionId = $this->postJson("/api/v1/citizen/textile-collections/{$req->id}/capacity-exception", [
        'reason' => 'Valid reason for decide validation test.',
    ])->assertCreated()->json('data.id');

    Sanctum::actingAs($staff);
    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        'decision' => 'maybe',
    ])->assertUnprocessable()->assertJsonValidationErrors(['decision']);

    $this->postJson("/api/v1/department/textile-capacity/exceptions/{$exceptionId}/decide", [
        // missing decision
        'reason' => 'Missing decision',
    ])->assertUnprocessable()->assertJsonValidationErrors(['decision']);
});

it('category allowlist violation is flagged as blocker', function (): void {
    $dept = capacityEnsurePartner('DR_LINEN');
    $zone = capacityZone($dept);
    $staff = capacityStaff($dept);

    Sanctum::actingAs($staff);
    $this->postJson('/api/v1/department/textile-capacity/rules', capacityRulePayload($zone, [
        'max_bags' => 20,
        'category_allowlist' => ['clothes_waste'],
    ]))->assertCreated();

    // Create a metal_scrap request (zone owner has capability for metal via ensurePartner, but rule restricts to clothes)
    $req = capacityCreateRequest(capacityCitizen(), $zone, ['category' => 'metal_scrap', 'estimated_bags' => 2]);
    $batch = capacityApproveAndSchedule($zone, $req, $staff, Carbon::tomorrow()->toDateString());

    Sanctum::actingAs($staff);
    $eval = $this->postJson("/api/v1/department/textile-batches/{$batch->id}/evaluate-capacity")->assertOk()->json('data');

    expect($eval['ok'])->toBeFalse()
        ->and(collect($eval['blockers'])->pluck('code')->contains('incompatible_category'))->toBeTrue();
});
