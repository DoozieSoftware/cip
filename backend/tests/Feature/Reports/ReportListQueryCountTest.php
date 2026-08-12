<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('citizen report list runs a bounded number of queries (no N+1)', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 10) as $i) {
        Report::factory()->create([
            'citizen_id' => $citizen->id,
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($citizen);

    DB::enableQueryLog();
    $response = $this->getJson('/api/v1/citizen/reports?per_page=25');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(10);

    // Paginated list with eager-loaded relations should run a bounded
    // number of queries regardless of row count: 1 for the report
    // count, 1 for the report rows, 1 per eager-loaded relation set.
    // Allow headroom for the citizen count query but assert it stays
    // well below the N+1 threshold (10 reports × 5 relations = 50+).
    expect($queries)->toBeLessThanOrEqual(15);
});

it('staff report list runs a bounded number of queries (no N+1)', function (): void {
    $staff = User::factory()->create();
    $staff->assignRole('moderator');

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 10) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($staff);

    DB::enableQueryLog();
    $response = $this->getJson('/api/v1/reports?per_page=25');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(10);

    // Same bounded-query guarantee as the citizen list.
    expect($queries)->toBeLessThanOrEqual(15);
});

it('admin report list runs a bounded number of queries (no N+1)', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 10) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($admin);

    DB::enableQueryLog();
    $response = $this->getJson('/api/v1/admin/reports?per_page=25');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(10);

    // Admin list eager-loads reportType, status, priority, department,
    // location, activeAssignments.department, activeAssignments.officer.
    // Assert bounded — well below N+1.
    expect($queries)->toBeLessThanOrEqual(20);
});

it('citizen list caps per_page at 50', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();

    foreach (range(1, 60) as $i) {
        Report::factory()->create([
            'citizen_id' => $citizen->id,
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($citizen);

    $response = $this->getJson('/api/v1/citizen/reports?per_page=200');

    $response->assertOk();
    expect($response->json('per_page'))->toBe(50);
    expect($response->json('data'))->toHaveCount(50);
});

it('admin list caps per_page at 100', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 120) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($admin);

    $response = $this->getJson('/api/v1/admin/reports?per_page=500');

    $response->assertOk();
    expect($response->json('per_page'))->toBe(100);
    expect($response->json('data'))->toHaveCount(100);
});

it('staff list caps per_page at 100', function (): void {
    $staff = User::factory()->create();
    $staff->assignRole('moderator');

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();

    foreach (range(1, 120) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'title' => "Report {$i}",
        ]);
    }

    Sanctum::actingAs($staff);

    $response = $this->getJson('/api/v1/reports?per_page=500');

    $response->assertOk();
    expect($response->json('per_page'))->toBe(100);
    expect($response->json('data'))->toHaveCount(100);
});

it('moderator queue runs a bounded number of queries and caps per_page', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 10) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'submitted_at' => now()->subMinutes($i),
            'title' => "Queue report {$i}",
        ]);
    }

    Sanctum::actingAs($moderator);

    DB::enableQueryLog();
    $response = $this->getJson('/api/v1/moderator/queue?per_page=25');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();

    $response->assertOk();
    expect($response->json('data.items'))->toHaveCount(10);

    // Cursor-paginated queue with eager-loaded relations + media count.
    // Without the fix each row triggered its own media/proof-photo query.
    expect($queries)->toBeLessThanOrEqual(15);

    // The queue already caps per_page; assert the cap holds.
    $capped = $this->getJson('/api/v1/moderator/queue?per_page=500');
    $capped->assertOk();
    expect(count($capped->json('data.items')))->toBeLessThanOrEqual(100);
});

it('operations department list runs a bounded number of queries and caps per_page', function (): void {
    $department = Department::factory()->create(['code' => 'OPS-N1']);
    $officer = makeDepartmentOfficer($department);

    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();

    foreach (range(1, 10) as $i) {
        Report::factory()->create([
            'report_type_id' => $type->id,
            'current_status_id' => $assigned->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Ops report {$i}",
        ]);
    }

    Sanctum::actingAs($officer);

    DB::enableQueryLog();
    $response = $this->getJson('/api/v1/department/reports?per_page=25');
    $queries = count(DB::getQueryLog());
    DB::disableQueryLog();

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(10);

    // The list resource must not fan out into per-row media, status
    // history, or assignment queries — those belong to the detail
    // endpoint only.
    expect($queries)->toBeLessThanOrEqual(20);

    $capped = $this->getJson('/api/v1/department/reports?per_page=500');
    $capped->assertOk();
    expect($capped->json('meta.per_page'))->toBeLessThanOrEqual(100);
});

it('report list rows never lazy-load a relation', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->where('code', 'roads')->firstOrFail();
    $status = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $department = Department::factory()->create();

    foreach (range(1, 5) as $i) {
        Report::factory()->create([
            'citizen_id' => $citizen->id,
            'report_type_id' => $type->id,
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'department_id' => $department->id,
            'title' => "Strict report {$i}",
        ]);
    }

    // Strict mode turns any lazy load inside the list path into an
    // exception, which is the sharpest possible N+1 regression guard.
    Model::preventLazyLoading();

    Sanctum::actingAs($citizen);

    try {
        $this->getJson('/api/v1/citizen/reports?per_page=25')->assertOk();
    } finally {
        Model::preventLazyLoading(false);
    }
});
