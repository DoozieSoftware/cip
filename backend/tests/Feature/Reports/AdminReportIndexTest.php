<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
});

function adminReportUser(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('requires the super_admin role for the cross-department list', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $this->getJson('/api/v1/admin/reports')->assertForbidden();
});

it('lists reports across departments with assignment summaries', function (): void {
    $primaryDepartment = Department::factory()->create(['code' => 'ROADS']);
    $secondaryDepartment = Department::factory()->create(['code' => 'WATER']);
    $status = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $report = Report::factory()->create([
        'department_id' => $primaryDepartment->id,
        'current_status_id' => $status->id,
        'submitted_at' => now()->subDay(),
    ]);
    $officer = User::factory()->create(['name' => 'Water Officer']);
    ReportAssignment::factory()->create([
        'report_id' => $report->id,
        'department_id' => $secondaryDepartment->id,
        'officer_id' => $officer->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
    ]);

    Sanctum::actingAs(adminReportUser());
    $response = $this->getJson('/api/v1/admin/reports');

    $response->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.department.code', 'ROADS')
        ->assertJsonPath('data.0.assignments.0.kind', 'secondary')
        ->assertJsonPath('data.0.assignments.0.department.code', 'WATER')
        ->assertJsonPath('data.0.assignments.0.officer.name', 'Water Officer');
});

it('composes department, status, category, officer, date, and assignment filters', function (): void {
    $primaryDepartment = Department::factory()->create(['code' => 'ROADS']);
    $secondaryDepartment = Department::factory()->create(['code' => 'WATER']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();
    $type = ReportType::factory()->create(['code' => 'admin_water_leakage']);
    $officer = User::factory()->create(['name' => 'Water Officer']);

    $match = Report::factory()->create([
        'department_id' => $primaryDepartment->id,
        'report_type_id' => $type->id,
        'current_status_id' => $resolved->id,
        'submitted_at' => now()->subDays(3),
        'title' => 'Match all filters',
    ]);
    ReportAssignment::factory()->create([
        'report_id' => $match->id,
        'department_id' => $secondaryDepartment->id,
        'officer_id' => $officer->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
    ]);
    Report::factory()->create([
        'department_id' => $primaryDepartment->id,
        'current_status_id' => $assigned->id,
        'submitted_at' => now()->subDays(3),
    ]);

    Sanctum::actingAs(adminReportUser());
    $response = $this->getJson('/api/v1/admin/reports?department_id='.$secondaryDepartment->id.'&status=resolved&category=admin_water_leakage&officer_id='.$officer->id.'&assignment_type=secondary&date_from='.now()->subDays(4)->toDateString().'&date_to='.now()->subDays(2)->toDateString());

    $response->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.title', 'Match all filters');
});
