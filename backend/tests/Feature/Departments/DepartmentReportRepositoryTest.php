<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentReportRepository;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
});

it('returns only the requested department\'s reports', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $deptB = Department::factory()->create(['code' => 'B']);
    Report::factory()->count(3)->create(['department_id' => $deptA->id]);
    Report::factory()->count(2)->create(['department_id' => $deptB->id]);

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

it('filters by report type code when category is supplied', function (): void {
    $deptA = Department::factory()->create(['code' => 'A']);
    $pothole = ReportType::factory()->create(['code' => 'pothole']);
    $garbage = ReportType::factory()->create(['code' => 'garbage']);
    Report::factory()->create(['department_id' => $deptA->id, 'report_type_id' => $pothole->id]);
    Report::factory()->create(['department_id' => $deptA->id, 'report_type_id' => $garbage->id]);

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
