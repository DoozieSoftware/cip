<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Policies\DepartmentPolicy;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndPermissionsSeeder::class);
});

it('a non-member department officer is denied view, accept, addNote', function (): void {
    $deptA = Department::factory()->create(['name' => 'BBMP', 'code' => 'BBMP-A']);
    $deptB = Department::factory()->create(['name' => 'BTP', 'code' => 'BTP-B']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($deptA->id);
    $report = Report::factory()->create(['department_id' => $deptB->id]);

    expect((new DepartmentPolicy)->view($officer, $report))->toBeFalse();
    expect((new DepartmentPolicy)->accept($officer, $report))->toBeFalse();
    expect((new DepartmentPolicy)->addNote($officer, $report))->toBeFalse();
});

it('a member of the department can view and act on its reports', function (): void {
    $deptA = Department::factory()->create(['name' => 'BBMP', 'code' => 'BBMP-A']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($deptA->id);
    $report = Report::factory()->create(['department_id' => $deptA->id]);

    $p = new DepartmentPolicy;
    expect($p->view($officer, $report))->toBeTrue();
    expect($p->accept($officer, $report))->toBeTrue();
    expect($p->start($officer, $report))->toBeTrue();
    expect($p->resolve($officer, $report))->toBeTrue();
    expect($p->addNote($officer, $report))->toBeTrue();
});

it('a member of an open secondary assignment can view and act on the report', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY-A']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY-B']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($secondary->id);
    $report = Report::factory()->create(['department_id' => $primary->id]);
    ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);

    $p = new DepartmentPolicy;
    expect($p->view($officer, $report))->toBeTrue()
        ->and($p->accept($officer, $report))->toBeTrue()
        ->and($p->close($officer, $report))->toBeFalse();
});

it('allows the primary department to close the master complaint', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY-CLOSE']);
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    $officer = User::factory()->create();
    $officer->assignRole('department');
    $officer->departments()->attach($primary->id);
    $report = Report::factory()->create(['department_id' => $primary->id]);

    expect((new DepartmentPolicy)->close($officer, $report))->toBeTrue();
});

it('a citizen (no department role) cannot view or act', function (): void {
    $deptA = Department::factory()->create(['name' => 'BBMP', 'code' => 'BBMP-A']);
    Role::firstOrCreate(['name' => 'citizen', 'guard_name' => 'web']);
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');
    $report = Report::factory()->create(['department_id' => $deptA->id]);

    $p = new DepartmentPolicy;
    expect($p->view($citizen, $report))->toBeFalse();
    expect($p->viewDashboard($citizen))->toBeFalse();
});

it('super_admin bypasses via the base policy', function (): void {
    $deptA = Department::factory()->create(['name' => 'BBMP', 'code' => 'BBMP-A']);
    Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $report = Report::factory()->create(['department_id' => $deptA->id]);

    expect(Gate::forUser($admin)->allows('department.view', $report))->toBeTrue();
    expect(Gate::forUser($admin)->allows('department.view_dashboard'))->toBeTrue();
});

it('viewDashboard requires the department role or super_admin/system', function (): void {
    Role::firstOrCreate(['name' => 'department', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'department_officer', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $mod = User::factory()->create();
    $mod->assignRole('moderator');

    $p = new DepartmentPolicy;
    expect($p->viewDashboard($officer))->toBeTrue();
    expect($p->viewDashboard($mod))->toBeFalse();
    expect($p->viewDashboard(User::factory()->create()))->toBeFalse();
});
