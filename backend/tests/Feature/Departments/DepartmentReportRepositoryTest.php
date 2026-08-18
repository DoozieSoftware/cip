<?php

declare(strict_types=1);

use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
});

it('returns only the requested department\'s reports', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->count(3)->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id]);
    Report::factory()->count(2)->create(['department_id' => $deptB->id, 'current_status_id' => $assigned->id]);

    $page = app(DepartmentReportRepository::class)->assignedTo($deptA->id);

    expect($page->total())->toBe(3);
});

it('filters compose on status + search', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $accepted = ReportStatus::query()->where('code', 'accepted')->firstOrFail();
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id, 'title' => 'pothole in MG road']);
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id, 'title' => 'garbage dump']);
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $accepted->id, 'title' => 'pothole on 5th ave']);

    $page = app(DepartmentReportRepository::class)->assignedTo($deptA->id, [
        'status' => 'assigned',
        'search' => 'pothole',
    ]);

    expect($page->total())->toBe(1);
    expect($page->items()[0]->title)->toContain('pothole');
});

it('filters both terminal completion paths as one completed queue', function (): void {
    $deptA = Department::factory()->create(['code' => 'A-COMPLETED']);
    $verified = ReportStatus::query()->where('code', 'verified')->firstOrFail();
    $closed = ReportStatus::query()->where('code', 'closed')->firstOrFail();
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $verified->id]);
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $closed->id]);
    Report::factory()->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id]);

    $page = app(DepartmentReportRepository::class)->assignedTo($deptA->id, [
        'status' => 'verified,closed',
    ]);

    expect($page->total())->toBe(2);
});

it('filters by report type code when category is supplied', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $pothole = ReportType::query()->where('code', 'pothole')->firstOrFail();
    $garbage = ReportType::query()->where('code', 'garbage')->firstOrFail();
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->create(['department_id' => $deptA->id, 'report_type_id' => $pothole->id, 'current_status_id' => $assigned->id]);
    Report::factory()->create(['department_id' => $deptA->id, 'report_type_id' => $garbage->id, 'current_status_id' => $assigned->id]);

    $page = app(DepartmentReportRepository::class)->assignedTo($deptA->id, [
        'category' => 'pothole',
    ]);

    expect($page->total())->toBe(1);
    expect($page->items()[0]->report_type_id)->toBe($pothole->id);
});

it('caps per_page at the documented max of 500', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $page = app(DepartmentReportRepository::class)->assignedTo($deptA->id, ['per_page' => 9999]);
    expect($page->perPage())->toBeLessThanOrEqual(500);
});

it('dashboard counts returns open / due_today / sla_breached / by_category', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    Report::factory()->count(2)->create(['department_id' => $deptA->id, 'current_status_id' => $assigned->id]);
    $counts = app(DepartmentReportRepository::class)->dashboardCounts($deptA->id);
    expect($counts['open'])->toBe(2);
    expect($counts)->toHaveKeys(['open', 'due_today', 'sla_breached', 'by_category']);
});

it('includes reports held by an open secondary assignment in the target queue', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY', 'default_sla_minutes' => 480]);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $report = Report::factory()->create([
        'department_id' => $primary->id,
        'current_status_id' => $assigned->id,
    ]);

    ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $primary->id,
        'is_primary' => true,
        'kind' => ReportAssignment::KIND_PRIMARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 1440,
    ]);
    ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);

    $page = app(DepartmentReportRepository::class)->assignedTo($secondary->id);
    $request = Request::create('/api/v1/department/reports', 'GET', ['department_id' => $secondary->id]);
    $data = (new DepartmentReportResource($page->items()[0]))->toArray($request);

    expect($page->total())->toBe(1)
        ->and($data['assignment'])->toMatchArray([
            'department_id' => $secondary->id,
            'is_primary' => false,
            'kind' => ReportAssignment::KIND_SECONDARY,
            'status' => ReportAssignment::TASK_STATUS_OPEN,
            'sla_minutes' => 480,
        ]);
});

it('filters the operations queue to secondary assignments when requested', function (): void {
    $primary = Department::factory()->create(['code' => 'PRIMARY-FILTER']);
    $secondary = Department::factory()->create(['code' => 'SECONDARY-FILTER']);
    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $report = Report::factory()->create([
        'department_id' => $primary->id,
        'current_status_id' => $assigned->id,
    ]);
    ReportAssignment::query()->create([
        'report_id' => $report->id,
        'department_id' => $secondary->id,
        'is_primary' => false,
        'kind' => ReportAssignment::KIND_SECONDARY,
        'assigned_at' => now(),
        'task_status' => ReportAssignment::TASK_STATUS_OPEN,
        'sla_minutes' => 480,
    ]);

    $page = app(DepartmentReportRepository::class)->assignedTo($secondary->id, [
        'assignment_kind' => ReportAssignment::KIND_SECONDARY,
    ]);

    expect($page->total())->toBe(1);
});
