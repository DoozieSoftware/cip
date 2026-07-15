<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Reports\Models\InternalNote;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    Role::firstOrCreate(['name' => 'department_officer', 'guard_name' => 'web']);
});

it('accept transitions assigned -> accepted and writes audit', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $updated = app(DepartmentReportService::class)->accept($report, $officer, null);

    expect($updated->status?->code)->toBe('accepted');
    expect(AuditLog::query()->where('action', 'report.department_action')->count())->toBe(1);
});

it('start transitions accepted -> in_progress', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $accepted = ReportStatus::query()->where('code', 'accepted')->firstOrFail();
    $report->current_status_id = $accepted->id;
    $report->save();
    $dept = Department::query()->find($report->department_id);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $updated = app(DepartmentReportService::class)->start($report, $officer, null);

    expect($updated->status?->code)->toBe('in_progress');
});

it('resolve transitions in_progress -> resolved', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $inProgress = ReportStatus::query()->where('code', 'in_progress')->firstOrFail();
    $report->current_status_id = $inProgress->id;
    $report->save();
    $dept = Department::query()->find($report->department_id);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $updated = app(DepartmentReportService::class)->resolve($report, $officer, null, 'fixed it');

    expect($updated->status?->code)->toBe('resolved');
    expect(AuditLog::query()->where('action', 'report.department_action')->latest('created_at')->first()->after)->toMatchArray([
        'event' => 'resolve',
    ]);
});

it('progress does NOT transition state, only records the audit', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $updated = app(DepartmentReportService::class)->progress($report, $officer, null, 'on-site visit done');

    expect($updated->status?->code)->toBe('assigned');
    expect(AuditLog::query()->where('action', 'report.department_progress')->count())->toBe(1);
});

it('close transitions resolved -> closed for a department officer', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();
    $report->current_status_id = $resolved->id;
    $report->save();
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $updated = app(DepartmentReportService::class)->close($report, $officer, null);

    expect($updated->status?->code)->toBe('closed');
});

it('addNote creates a department-internal note + audit row', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $note = app(DepartmentReportService::class)->addNote($report, $officer, 'inspected on 2026-06-29', null);

    expect($note->body)->toBe('inspected on 2026-06-29');
    expect(InternalNote::query()->where('report_id', $report->id)->count())->toBe(1);
    expect(AuditLog::query()->where('action', 'report.note_added')->count())->toBe(1);
});

it('addNote rejects an empty body with 422', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    expect(fn () => app(DepartmentReportService::class)->addNote($report, $officer, '   ', null))
        ->toThrow(ApiException::class);
});

it('accept writes a status-history row with correct from/to (no X -> X no-op)', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept); // starts in `assigned`
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    app(DepartmentReportService::class)->accept($report, $officer, null);

    $history = $report->statusHistory()->orderBy('created_at')->get();
    // Exactly one transition row, and it must be assigned -> accepted,
    // never the buggy "accepted -> accepted" self-transition.
    expect($history)->toHaveCount(1);
    expect($history->first()->fromStatus?->code)->toBe('assigned');
    expect($history->first()->toStatus?->code)->toBe('accepted');
});

it('Start, Resolve and Close each write a single correct status-history row', function (): void {
    $dept = Department::factory()->create();
    $report = landReportInAssigned($dept);
    $officer = User::factory()->create();
    $officer->assignRole('department_officer');
    $officer->departments()->attach($dept->id);

    $service = app(DepartmentReportService::class);
    $service->accept($report, $officer, null);
    $service->start($report->refresh(), $officer, null);
    $service->resolve($report->refresh(), $officer, null, 'fixed');
    $service->close($report->refresh(), $officer, null);

    $rows = $report->statusHistory()->orderBy('created_at')->get();
    $transitions = $rows->map(fn ($h) => "{$h->fromStatus?->code}->{$h->toStatus?->code}")->all();

    // No self-transitions anywhere in the timeline.
    foreach ($rows as $row) {
        expect($row->fromStatus?->code)->not->toBe($row->toStatus?->code);
    }
    expect($transitions)->toBe([
        'assigned->accepted',
        'accepted->in_progress',
        'in_progress->resolved',
        'resolved->closed',
    ]);
});
