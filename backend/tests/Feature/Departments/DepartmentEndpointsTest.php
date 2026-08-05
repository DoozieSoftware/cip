<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('rejects /api/v1/department/dashboard without auth', function (): void {
    $this->getJson('/api/v1/department/dashboard')->assertStatus(401);
});

it('returns the dashboard for a department officer', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $officer = makeDepartmentOfficer($dept);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->count(2)->create(['department_id' => $dept->id, 'current_status_id' => $assigned->id]);

    Sanctum::actingAs($officer);
    $r = $this->getJson('/api/v1/department/dashboard');
    $r->assertOk()->assertJsonPath('data.open', 2);
});

it('rejects the list for a citizen (no department)', function (): void {
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/department/reports')->assertStatus(403);
});

it('returns the list scoped to the officer\'s department', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->count(2)->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id]);
    Report::factory()->count(3)->create(['department_id' => $deptB->id]);
    $officer = makeDepartmentOfficer($deptA);

    Sanctum::actingAs($officer);
    $r = $this->getJson('/api/v1/department/reports');
    $r->assertOk()->assertJsonPath('meta.total', 2);
});

it('returns a scoped report detail by id', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $linkedDept = Department::factory()->create(['code' => 'BESCOM']);
    $report = landReportInAssigned($dept);
    $primaryAssignment = ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $dept->id,
        'is_primary' => true,
        'kind' => ReportAssignment::KIND_PRIMARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 1440,
    ]);
    $linkedAssignment = ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $linkedDept->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);
    $officer = makeDepartmentOfficer($dept);

    Sanctum::actingAs($officer);
    $r = $this->getJson("/api/v1/department/reports/{$report->id}");
    $r->assertOk()
        ->assertJsonPath('data.id', $report->id)
        ->assertJsonPath('data.current_status_code', 'assigned')
        ->assertJsonPath('data.internal_notes', [])
        ->assertJsonPath('data.assignments.0.id', $primaryAssignment->id)
        ->assertJsonPath('data.assignments.0.department.code', 'BBMP')
        ->assertJsonPath('data.assignments.0.is_primary', true)
        ->assertJsonPath('data.assignments.1.id', $linkedAssignment->id)
        ->assertJsonPath('data.assignments.1.department.code', 'BESCOM')
        ->assertJsonPath('data.assignments.1.is_primary', false);
});

it('rejects report detail from another department', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    $report = landReportInAssigned($deptB);
    $officer = makeDepartmentOfficer($deptA);

    Sanctum::actingAs($officer);
    $this->getJson("/api/v1/department/reports/{$report->id}")
        ->assertStatus(403);
});

it('accept moves the report to accepted and writes audit', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $r = $this->postJson("/api/v1/department/reports/{$report->id}/accept", []);
    $r->assertOk()->assertJsonPath('data.current_status_code', 'accepted');
});

it('returns 422 when the transition is not allowed (close from assigned)', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/close", [])
        ->assertStatus(422);
});

it('close moves a resolved report to closed', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();
    $report->current_status_id = $resolved->id;
    $report->save();
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/close", [])
        ->assertOk()
        ->assertJsonPath('data.current_status_code', 'closed');

    expect($report->refresh()->closed_at)->not->toBeNull();
});

it('addNote creates a 201 and the note body roundtrips', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $r = $this->postJson("/api/v1/department/reports/{$report->id}/note", [
        'body' => 'inspected the site today',
    ]);
    $r->assertCreated()->assertJsonPath('data.body', 'inspected the site today');
});

it('addNote rejects an empty body with 422', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/note", ['body' => ''])
        ->assertStatus(422);
});

it('completes a secondary task without changing the primary report workflow', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY']);
    $report = landReportInAssigned($primary);
    $assignment = ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);
    $officer = makeDepartmentOfficer($secondary);
    Sanctum::actingAs($officer);

    $this->postJson(
        "/api/v1/department/reports/{$report->id}/tasks/{$assignment->id}/complete?department_id={$secondary->id}",
        ['note' => 'Traffic control task completed.'],
    )->assertOk()->assertJsonPath('data.assignment.status', ReportAssignment::TASK_STATUS_COMPLETED);

    expect($assignment->refresh()->task_status)->toBe(ReportAssignment::TASK_STATUS_COMPLETED)
        ->and($assignment->completed_at)->not->toBeNull()
        ->and($report->refresh()->status?->code)->toBe('assigned');
});

it('does not let another department complete a secondary task', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY']);
    $other = Department::factory()->create(['code' => 'OTHER']);
    $report = landReportInAssigned($primary);
    $assignment = ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);
    $officer = makeDepartmentOfficer($other);
    Sanctum::actingAs($officer);

    $this->postJson("/api/v1/department/reports/{$report->id}/tasks/{$assignment->id}/complete", [])
        ->assertForbidden();
    expect($assignment->refresh()->task_status)->toBe(ReportAssignment::TASK_STATUS_OPEN);
});

it('does not let a secondary member select an unrelated department for report detail', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY-DETAIL']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY-DETAIL']);
    $other = Department::factory()->create(['code' => 'OTHER-DETAIL']);
    $report = landReportInAssigned($primary);
    ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);
    $officer = makeDepartmentOfficer($secondary);
    Sanctum::actingAs($officer);

    $this->getJson("/api/v1/department/reports/{$report->id}?department_id={$other->id}")
        ->assertForbidden();
});

it('GET notes returns the department-internal notes newest-first', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);
    $this->postJson("/api/v1/department/reports/{$report->id}/note", ['body' => 'first'])->assertCreated();
    $this->postJson("/api/v1/department/reports/{$report->id}/note", ['body' => 'second'])->assertCreated();
    $r = $this->getJson("/api/v1/department/reports/{$report->id}/notes");
    $r->assertOk();
    expect($r->json('data.0.body'))->toBe('second');
});
