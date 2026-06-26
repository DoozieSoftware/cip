<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Event::fake([ReportAssigned::class]);
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();

    $workflow = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();

    $this->deptA = Department::factory()->create(['name' => 'BBMP Ward 112']);
    $this->deptB = Department::factory()->create(['name' => 'BBMP Ward 113']);
    $this->priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $this->high = ReportPriority::query()->where('code', 'high')->firstOrFail();
    $this->type = ReportType::factory()->create();

    $this->report = Report::factory()->create([
        'report_type_id' => $this->type->id,
        'current_status_id' => ReportStatus::query()->where('code', 'assigned')->firstOrFail()->id,
        'department_id' => $this->deptA->id,
        'priority_id' => $this->priority->id,
        'workflow_id' => $workflow->id,
    ]);

    $this->previousOfficer = User::factory()->create();
    $this->newOfficer = User::factory()->create();

    $this->previousAssignment = ReportAssignment::query()->create([
        'report_id' => $this->report->id,
        'department_id' => $this->deptA->id,
        'officer_id' => $this->previousOfficer->id,
        'assigned_by' => null,
        'assigned_at' => now()->subHour(),
    ]);
});

it('super_admin can reassign a report to a new department and officer', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $response = $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'officer_id' => $this->newOfficer->id,
        'reason' => 'Wrong ward assigned by AI - manual override.',
    ]);

    $response->assertOk();
    expect($response->json('data.department_id'))->toBe($this->deptB->id)
        ->and($response->json('data.officer_id'))->toBe($this->newOfficer->id);

    $this->previousAssignment->refresh();
    expect($this->previousAssignment->reassigned_at)->not->toBeNull()
        ->and($this->previousAssignment->reassignment_reason)->toContain('Wrong ward');

    $active = ReportAssignment::query()
        ->where('report_id', $this->report->id)
        ->whereNull('reassigned_at')
        ->whereNull('completed_at')
        ->first();

    expect($active)->not->toBeNull()
        ->and($active->department_id)->toBe($this->deptB->id)
        ->and($active->officer_id)->toBe($this->newOfficer->id);

    $fresh = $this->report->fresh();
    expect($fresh->department_id)->toBe($this->deptB->id);

    Event::assertDispatched(ReportAssigned::class, fn (ReportAssigned $e): bool => $e->departmentId === $this->deptB->id
        && $e->officerId === $this->newOfficer->id);
});

it('moderator can also reassign', function (): void {
    $mod = User::factory()->create();
    $mod->assignRole('moderator');
    Sanctum::actingAs($mod);

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'reason' => 'Re-routing for SLA.',
    ])->assertOk();
});

it('citizen gets 403 on reassign', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'reason' => 'I want a different department',
    ])->assertStatus(403);
});

it('reassign updates the report priority when priority_id is supplied', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'priority_id' => $this->high->id,
        'reason' => 'Severity escalated to high.',
    ])->assertOk();

    expect($this->report->fresh()->priority_id)->toBe($this->high->id);
});

it('reassign writes an audit_logs row', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'reason' => 'audit check',
    ])->assertOk();

    expect(AuditLog::query()->where('entity', 'reports')->where('entity_id', $this->report->id)->where('action', 'report.reassign')->count())->toBe(1);
});

it('reassign without a previous active assignment still works (no row to close)', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    ReportAssignment::query()->where('id', $this->previousAssignment->id)->delete();

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
        'reason' => 'first assignment',
    ])->assertOk();

    expect(ReportAssignment::query()->where('report_id', $this->report->id)->whereNull('reassigned_at')->count())->toBe(1);
});

it('reassign requires a reason (VALIDATION_FAILED otherwise)', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/reports/{$this->report->id}/reassign", [
        'department_id' => $this->deptB->id,
    ])->assertStatus(422)->assertJsonPath('code', 'VALIDATION_FAILED');
});
