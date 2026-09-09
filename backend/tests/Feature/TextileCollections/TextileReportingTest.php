<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileCapacityException;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileOfflineRecoveryItem;
use App\Modules\TextileCollections\Models\TextilePartnerCapability;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

// ── Helpers (reporting prefix) ────────────────────────────────────────

function reportingEnsurePartner(string $code, array $categories = ['clothes_waste']): Department
{
    $dept = Department::query()->where('code', $code)->first();

    if (! $dept instanceof Department) {
        $dept = Department::factory()->create([
            'code' => $code,
            'name' => $code.' Reporting Partner',
            'active' => true,
        ]);
    }

    foreach ($categories as $cat) {
        TextilePartnerCapability::query()->updateOrCreate(
            ['department_id' => $dept->id, 'category' => $cat],
        );
    }

    return $dept;
}

function reportingZone(Department $dept, string $suffix = ''): TextileServiceZone
{
    return TextileServiceZone::query()->create([
        'code' => 'REP-'.strtoupper(substr(uniqid(), -6)).$suffix,
        'name' => 'Reporting Zone '.$dept->code.($suffix !== '' ? ' '.$suffix : ''),
        'department_id' => $dept->id,
        'dropoff_enabled' => true,
        'premises_pickup_enabled' => true,
        'active' => true,
    ]);
}

function reportingStaff(Department $dept): User
{
    $staff = User::factory()->create();
    $staff->departments()->attach($dept->id, ['active' => true]);

    return $staff;
}

function reportingCitizen(): User
{
    return User::factory()->create();
}

/**
 * Create a textile request directly, bypassing service validation, so the
 * reporting period and status can be controlled deterministically.
 *
 * @param  array<string, mixed>  $overrides
 */
function reportingCreateRequest(Department $dept, TextileServiceZone $zone, User $citizen, array $overrides = []): TextileCollectionRequest
{
    $now = Carbon::now();

    $defaults = [
        'citizen_id' => $citizen->id,
        'title' => 'Reporting pickup '.Str::random(6),
        'category' => 'clothes_waste',
        'service_zone_id' => $zone->id,
        'department_id' => $dept->id,
        'requester_type' => 'individual',
        'requester_name' => 'Asha Rao',
        'contact_email' => 'asha-report-'.Str::random(4).'@example.com',
        'contact_phone' => '+91 98765'.random_int(10000, 99999),
        'pickup_address' => '12, MG Road, Bengaluru 560001',
        'collection_method' => 'premises',
        'estimated_bags' => 3,
        'estimated_weight_kg' => 8.5,
        'actual_bags' => null,
        'actual_weight_kg' => null,
        'status' => TextileCollectionRequest::STATUS_PENDING_REVIEW,
        'created_at' => $now,
        'updated_at' => $now,
        'submitted_at' => $now,
    ];

    $attributes = array_merge($defaults, $overrides);

    // Honour explicit timestamps if provided.
    if (isset($overrides['created_at']) && $overrides['created_at'] instanceof Carbon) {
        $attributes['created_at'] = $overrides['created_at'];
        $attributes['updated_at'] = $overrides['created_at'];
        $attributes['submitted_at'] = $overrides['created_at'];
    }

    return TextileCollectionRequest::query()->create($attributes);
}

function reportingCreateBatch(Department $dept, TextileServiceZone $zone, User $creator, string $date): TextileCollectionBatch
{
    return TextileCollectionBatch::query()->create([
        'service_zone_id' => $zone->id,
        'reference' => 'REP-'.now()->format('ymd').'-'.strtoupper(Str::random(6)),
        'collection_date' => $date,
        'status' => TextileCollectionBatch::STATUS_PLANNED,
        'created_by' => $creator->id,
    ]);
}

// ── Dashboard totals reconcile ────────────────────────────────────────

it('dashboard totals reconcile with underlying collection records', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN', ['clothes_waste', 'metal_scrap', 'e_waste']);
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    // Create 3 requests with known estimates
    reportingCreateRequest($dept, $zone, $citizen, ['estimated_bags' => 2, 'estimated_weight_kg' => 5.0, 'actual_bags' => 2, 'actual_weight_kg' => 4.5, 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['estimated_bags' => 3, 'estimated_weight_kg' => 7.0, 'actual_bags' => 3, 'actual_weight_kg' => 7.0, 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['estimated_bags' => 1, 'estimated_weight_kg' => 2.0, 'created_at' => $now]);

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['totals']['requests'])->toBe(3)
        ->and($res['totals']['estimated_bags'])->toBe(6)
        ->and($res['totals']['actual_bags'])->toBe(5)
        ->and((float) $res['totals']['estimated_weight_kg'])->toBe(14.0)
        ->and((float) $res['totals']['actual_weight_kg'])->toBe(11.5);

    // Sum of status breakdown must equal total
    $statusSum = array_sum(array_values($res['breakdowns']['status']));
    expect($statusSum)->toBe($res['totals']['requests']);

    // Definitions and period are present
    expect($res['definitions'])->toHaveKeys(['requests', 'trips', 'variance', 'missed_rate'])
        ->and($res['period']['start'])->not->toBeNull()
        ->and($res['period']['end'])->not->toBeNull();
});

it('dashboard dropoff vs premises volumes are split correctly', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'dropoff', 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'dropoff', 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'premises', 'created_at' => $now]);

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['volumes']['dropoff'])->toBe(2)
        ->and($res['volumes']['premises'])->toBe(1)
        ->and($res['breakdowns']['collection_method']['dropoff'])->toBe(2)
        ->and($res['breakdowns']['collection_method']['premises'])->toBe(1);
});

it('dashboard missed, reschedule and exception rates are computed', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN', ['clothes_waste']);
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    // 4 requests total: 1 missed, 1 rescheduled, 2 normal
    reportingCreateRequest($dept, $zone, $citizen, ['status' => TextileCollectionRequest::STATUS_MISSED, 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['reschedule_count' => 1, 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);

    // One exception for the period
    $reqForException = reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);
    TextileCapacityException::query()->create([
        'collection_request_id' => $reqForException->id,
        'service_zone_id' => $zone->id,
        'department_id' => $dept->id,
        'requested_by' => $citizen->id,
        'status' => TextileCapacityException::STATUS_PENDING,
        'reason_code' => TextileCapacityException::REASON_BELOW_MINIMUM,
        'reason' => 'Exception for rate test.',
        'idempotency_key' => (string) Str::uuid(),
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    // Total now 5
    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['totals']['requests'])->toBe(5)
        ->and($res['rates']['missed_count'])->toBe(1)
        ->and($res['rates']['missed_rate_pct'])->toEqual(20.0)
        ->and($res['rates']['rescheduled_count'])->toBe(1)
        ->and($res['rates']['reschedule_rate_pct'])->toEqual(20.0)
        ->and($res['rates']['exception_count'])->toBe(1)
        ->and($res['rates']['exception_rate_pct'])->toEqual(20.0);
});

it('dashboard zone, category and method breakdowns are present', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN', ['clothes_waste', 'metal_scrap', 'e_waste']);
    $zoneA = reportingZone($dept, 'A');
    $zoneB = reportingZone($dept, 'B');
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    reportingCreateRequest($dept, $zoneA, $citizen, ['category' => 'clothes_waste', 'collection_method' => 'premises', 'created_at' => $now]);
    reportingCreateRequest($dept, $zoneA, $citizen, ['category' => 'clothes_waste', 'collection_method' => 'dropoff', 'created_at' => $now]);
    reportingCreateRequest($dept, $zoneB, $citizen, ['category' => 'metal_scrap', 'collection_method' => 'premises', 'created_at' => $now]);
    reportingCreateRequest($dept, $zoneB, $citizen, ['category' => 'e_waste', 'collection_method' => 'premises', 'created_at' => $now]);

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['breakdowns']['zone'])->toHaveKey($zoneA->name)
        ->and($res['breakdowns']['zone'])->toHaveKey($zoneB->name)
        ->and($res['breakdowns']['zone'][$zoneA->name])->toBe(2)
        ->and($res['breakdowns']['zone'][$zoneB->name])->toBe(2);

    expect($res['breakdowns']['category'])->toHaveKey('clothes_waste')
        ->and($res['breakdowns']['category']['clothes_waste'])->toBe(2)
        ->and($res['breakdowns']['category'])->toHaveKey('metal_scrap')
        ->and($res['breakdowns']['category'])->toHaveKey('e_waste');

    expect($res['breakdowns']['collection_method'])->toHaveKey('premises')
        ->and($res['breakdowns']['collection_method']['premises'])->toBe(3)
        ->and($res['breakdowns']['collection_method']['dropoff'])->toBe(1);

    // Timeseries and granularity are present
    expect($res)->toHaveKey('timeseries')
        ->and($res['granularity'])->toBeIn(['month', 'day']);
});

it('partner isolation: other partner sees only its own data', function (): void {
    $deptA = reportingEnsurePartner('DR_LINEN', ['clothes_waste']);
    $deptB = reportingEnsurePartner('REP_OTHER', ['clothes_waste']);
    $zoneA = reportingZone($deptA);
    $zoneB = reportingZone($deptB);
    $staffA = reportingStaff($deptA);
    $staffB = reportingStaff($deptB);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    // 2 for A, 3 for B
    reportingCreateRequest($deptA, $zoneA, $citizen, ['created_at' => $now]);
    reportingCreateRequest($deptA, $zoneA, $citizen, ['created_at' => $now]);
    reportingCreateRequest($deptB, $zoneB, $citizen, ['created_at' => $now]);
    reportingCreateRequest($deptB, $zoneB, $citizen, ['created_at' => $now]);
    reportingCreateRequest($deptB, $zoneB, $citizen, ['created_at' => $now]);

    Sanctum::actingAs($staffA);
    $resA = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');
    expect($resA['totals']['requests'])->toBe(2);

    Sanctum::actingAs($staffB);
    $resB = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');
    expect($resB['totals']['requests'])->toBe(3);

    // Ensure zone breakdown isolation: A's response must not contain B's zone name
    expect($resA['breakdowns']['zone'])->not->toHaveKey($zoneB->name)
        ->and($resB['breakdowns']['zone'])->not->toHaveKey($zoneA->name);
});

it('data-quality note before baseline shows insufficient volume', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    // Only 2 requests (<50)
    reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['data_quality']['has_baseline'])->toBeFalse()
        ->and($res['data_quality']['note'])->toContain('Insufficient volume')
        ->and($res['data_quality']['missing_estimates'])->toBeGreaterThanOrEqual(0);
});

it('data-quality note shows baseline established after 50 requests', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    // Create 55 requests (≥50)
    for ($i = 0; $i < 55; $i++) {
        $citizen = reportingCitizen();
        reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);
    }

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');

    expect($res['totals']['requests'])->toBe(55)
        ->and($res['data_quality']['has_baseline'])->toBeTrue()
        ->and($res['data_quality']['note'])->toContain('Baseline established');
});

it('export CSV contains expected headers and is audited', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    reportingCreateRequest($dept, $zone, $citizen, ['created_at' => $now]);

    Sanctum::actingAs($staff);
    $res = $this->getJson("/api/v1/department/textile-collections/report/export?year={$year}&format=csv")->assertOk();

    // Headers
    $res->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    $disposition = $res->headers->get('Content-Disposition');
    expect($disposition)->toContain('attachment; filename="textile-report-')
        ->and($disposition)->toContain('.csv"');

    $content = (string) $res->getContent();
    $lines = array_values(array_filter(explode("\n", $content), fn (string $line): bool => trim($line) !== ''));
    expect($lines[0] ?? '')->toContain('reference')
        ->and($lines[0] ?? '')->toContain('collection_method')
        ->and($lines[0] ?? '')->toContain('estimated_bags')
        ->and($lines[0] ?? '')->toContain('actual_bags')
        ->and($lines[0] ?? '')->toContain('service_zone')
        ->and(count($lines))->toBeGreaterThan(1);

    // Audited
    expect(AuditLog::query()->where('entity', 'textile_reporting')->where('entity_id', $dept->id)->where('action', 'textile.report_export')->exists())->toBeTrue();
});

it('export CSV totals reconcile with dashboard totals', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    reportingCreateRequest($dept, $zone, $citizen = reportingCitizen(), ['estimated_bags' => 4, 'estimated_weight_kg' => 10.0, 'created_at' => $now]);
    reportingCreateRequest($dept, $zone, $citizen2 = reportingCitizen(), ['estimated_bags' => 6, 'estimated_weight_kg' => 15.0, 'created_at' => $now]);

    Sanctum::actingAs($staff);
    $dashboard = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');
    $export = (string) $this->getJson("/api/v1/department/textile-collections/report/export?year={$year}&format=csv")->assertOk()->getContent();

    // Parse per-collection CSV rows and reconcile against dashboard totals.
    $lines = array_values(array_filter(explode("\n", $export), fn (string $line): bool => trim($line) !== ''));
    $parsedHeader = str_getcsv($lines[0] ?? '');
    $refIndex = array_search('reference', $parsedHeader, true);
    $bagsIndex = array_search('estimated_bags', $parsedHeader, true);
    expect($refIndex)->not->toBeFalse()
        ->and($bagsIndex)->not->toBeFalse();

    $dataLines = array_slice($lines, 1);
    $rowCount = count($dataLines);
    $bagTotal = 0;

    foreach ($dataLines as $line) {
        $cells = str_getcsv($line);
        $bagTotal += (int) ($cells[$bagsIndex] ?? 0);
        expect($cells[$refIndex] ?? '')->toContain('DLN-');
    }

    expect($rowCount)->toBe($dashboard['totals']['requests'])
        ->and($bagTotal)->toBe($dashboard['totals']['estimated_bags']);
});

it('dashboard requires partner authorization', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $citizen = reportingCitizen();
    reportingCreateRequest($dept, $zone, $citizen);

    // Unauthenticated → 401
    $this->getJson('/api/v1/department/textile-collections/report/dashboard')->assertUnauthorized();

    // Citizen (non-partner) → 403
    Sanctum::actingAs($citizen);
    $this->getJson('/api/v1/department/textile-collections/report/dashboard')->assertForbidden();
    $this->getJson('/api/v1/department/textile-collections/report/export')->assertForbidden();

    // Other partner cannot see this dept's data (tested isolation above) but can access own dashboard
    $otherDept = reportingEnsurePartner('REP_OTHER2', ['clothes_waste']);
    $otherStaff = reportingStaff($otherDept);
    Sanctum::actingAs($otherStaff);
    $year = (int) now()->format('Y');
    $res = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');
    expect($res['totals']['requests'])->toBe(0);
});

it('dashboard zone filter narrows results', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zoneA = reportingZone($dept, 'A');
    $zoneB = reportingZone($dept, 'B');
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $year = (int) now()->format('Y');
    $now = Carbon::now();

    reportingCreateRequest($dept, $zoneA, $citizen, ['created_at' => $now]);
    reportingCreateRequest($dept, $zoneA, $citizen, ['created_at' => $now]);
    reportingCreateRequest($dept, $zoneB, $citizen, ['created_at' => $now]);

    Sanctum::actingAs($staff);
    $all = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}")->assertOk()->json('data');
    expect($all['totals']['requests'])->toBe(3);

    $filtered = $this->getJson("/api/v1/department/textile-collections/report/dashboard?year={$year}&service_zone_id={$zoneA->id}")->assertOk()->json('data');
    expect($filtered['totals']['requests'])->toBe(2)
        ->and($filtered['breakdowns']['zone'])->toHaveKey($zoneA->name)
        ->and($filtered['breakdowns']['zone'])->not->toHaveKey($zoneB->name);
});

// ── Live snapshot ───────────────────────────────────────────────────

it('live snapshot reports today trips, stops, pending receipts and failed uploads', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();
    $today = Carbon::now()->toDateString();
    $tomorrow = Carbon::now()->addDay()->toDateString();

    $todayBatch = reportingCreateBatch($dept, $zone, $staff, $today);
    $otherDayBatch = reportingCreateBatch($dept, $zone, $staff, $tomorrow);

    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $todayBatch->id, 'status' => TextileCollectionRequest::STATUS_SCHEDULED]);
    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $todayBatch->id, 'status' => TextileCollectionRequest::STATUS_SCHEDULED]);
    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $todayBatch->id, 'status' => TextileCollectionRequest::STATUS_PICKED_UP]);
    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $todayBatch->id, 'status' => TextileCollectionRequest::STATUS_MISSED]);
    // Tomorrow's trip must not leak into today's snapshot.
    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $otherDayBatch->id, 'status' => TextileCollectionRequest::STATUS_SCHEDULED]);

    // Two drop-off bookings still awaiting a centre receipt.
    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'dropoff', 'status' => TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP]);
    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'dropoff', 'status' => TextileCollectionRequest::STATUS_READY_TO_GROUP]);
    // Premises ready_to_group is a scheduling queue item, not a centre receipt.
    reportingCreateRequest($dept, $zone, $citizen, ['collection_method' => 'premises', 'status' => TextileCollectionRequest::STATUS_READY_TO_GROUP]);

    // One pending + one resolved offline failure.
    $failed = reportingCreateRequest($dept, $zone, $citizen);
    TextileOfflineRecoveryItem::query()->create([
        'collection_request_id' => $failed->id,
        'reported_by' => $staff->id,
        'failure_reason' => 'Photo upload failed permanently',
        'status' => TextileOfflineRecoveryItem::STATUS_PENDING,
    ]);
    $resolved = reportingCreateRequest($dept, $zone, $citizen);
    TextileOfflineRecoveryItem::query()->create([
        'collection_request_id' => $resolved->id,
        'reported_by' => $staff->id,
        'failure_reason' => 'Already retried',
        'status' => TextileOfflineRecoveryItem::STATUS_RESOLVED,
    ]);

    Sanctum::actingAs($staff);
    $live = $this->getJson('/api/v1/department/textile-collections/report/live')->assertOk()->json('data');

    expect($live['date'])->toBe($today)
        ->and($live['trips']['total'])->toBe(1)
        ->and($live['stops']['total'])->toBe(4)
        ->and($live['stops']['pending'])->toBe(2)
        ->and($live['stops']['collected'])->toBe(1)
        ->and($live['stops']['missed'])->toBe(1)
        ->and($live['pending_receipts'])->toBe(2)
        ->and($live['failed_uploads'])->toBe(1);
});

it('live snapshot is partner-scoped and requires authorization', function (): void {
    $dept = reportingEnsurePartner('DR_LINEN');
    $zone = reportingZone($dept);
    $staff = reportingStaff($dept);
    $citizen = reportingCitizen();

    $batch = reportingCreateBatch($dept, $zone, $staff, Carbon::now()->toDateString());
    reportingCreateRequest($dept, $zone, $citizen, ['batch_id' => $batch->id, 'status' => TextileCollectionRequest::STATUS_SCHEDULED]);

    // Unauthenticated → 401, citizen → 403.
    $this->getJson('/api/v1/department/textile-collections/report/live')->assertUnauthorized();
    Sanctum::actingAs($citizen);
    $this->getJson('/api/v1/department/textile-collections/report/live')->assertForbidden();

    // Another partner sees only its own (empty) snapshot.
    $otherDept = reportingEnsurePartner('REP_OTHER3', ['clothes_waste']);
    $otherStaff = reportingStaff($otherDept);
    Sanctum::actingAs($otherStaff);
    $live = $this->getJson('/api/v1/department/textile-collections/report/live')->assertOk()->json('data');
    expect($live['trips']['total'])->toBe(0)
        ->and($live['stops']['total'])->toBe(0)
        ->and($live['pending_receipts'])->toBe(0)
        ->and($live['failed_uploads'])->toBe(0);
});
