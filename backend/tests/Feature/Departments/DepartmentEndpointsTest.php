<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
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
    Report::factory()->count(2)->create(['department_id' => $dept->id]);

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
    Report::factory()->count(2)->create(['department_id' => $deptA->id]);
    Report::factory()->count(3)->create(['department_id' => $deptB->id]);
    $officer = makeDepartmentOfficer($deptA);

    Sanctum::actingAs($officer);
    $r = $this->getJson('/api/v1/department/reports');
    $r->assertOk()->assertJsonPath('meta.total', 2);
});

it('returns a scoped report detail by id', function (): void {
    $dept = Department::factory()->create(['code' => 'BBMP']);
    $report = landReportInAssigned($dept);
    $officer = makeDepartmentOfficer($dept);

    Sanctum::actingAs($officer);
    $r = $this->getJson("/api/v1/department/reports/{$report->id}");
    $r->assertOk()
        ->assertJsonPath('data.id', $report->id)
        ->assertJsonPath('data.current_status_code', 'assigned')
        ->assertJsonPath('data.internal_notes', []);
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
