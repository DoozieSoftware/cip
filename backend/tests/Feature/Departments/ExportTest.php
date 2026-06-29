<?php

declare(strict_types=1);

use App\Modules\Departments\Exports\DepartmentReportsExport;
use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('rejects export without auth', function (): void {
    $dept = Department::factory()->create();
    $this->getJson("/api/v1/department/reports/export?format=csv")->assertStatus(401);
});

it('exports CSV with the right MIME and a downloadable file', function (): void {
    $dept = Department::factory()->create();
    $officer = makeDepartmentOfficer($dept);
    Report::factory()->count(3)->create(['department_id' => $dept->id]);

    Sanctum::actingAs($officer);
    $r = $this->get('/api/v1/department/reports/export?format=csv');
    $r->assertOk();
    expect($r->headers->get('content-type'))->toContain('text/csv');
    expect($r->headers->get('content-disposition'))->toContain('attachment');
    expect($r->headers->get('content-disposition'))->toContain('.csv');
});

it('exports XLSX with the right MIME', function (): void {
    $dept = Department::factory()->create();
    $officer = makeDepartmentOfficer($dept);
    Report::factory()->count(2)->create(['department_id' => $dept->id]);

    Sanctum::actingAs($officer);
    $r = $this->get('/api/v1/department/reports/export?format=xlsx');
    $r->assertOk();
    expect($r->headers->get('content-type'))->toContain('application/vnd.ms-excel');
});

it('exports PDF with the right MIME and a valid PDF body', function (): void {
    $dept = Department::factory()->create();
    $officer = makeDepartmentOfficer($dept);
    Report::factory()->count(2)->create(['department_id' => $dept->id]);

    Sanctum::actingAs($officer);
    $r = $this->get('/api/v1/department/reports/export?format=pdf');
    $r->assertOk();
    expect($r->headers->get('content-type'))->toContain('application/pdf');
    $body = $r->getContent();
    expect($body)->toStartWith('%PDF-1.4');
    expect($body)->toContain('%%EOF');
});

it('rejects an unsupported format with 400', function (): void {
    $dept = Department::factory()->create();
    $officer = makeDepartmentOfficer($dept);
    Sanctum::actingAs($officer);

    $r = $this->getJson('/api/v1/department/reports/export?format=docx');
    $r->assertStatus(400)->assertJsonPath('code', 'EXPORT_FORMAT_UNSUPPORTED');
});

it('respects the status filter on the export', function (): void {
    $dept = Department::factory()->create();
    $officer = makeDepartmentOfficer($dept);

    $assigned = ReportStatus::query()->where('code', 'assigned')->firstOrFail();
    $accepted = ReportStatus::query()->where('code', 'accepted')->firstOrFail();
    $inProg = ReportStatus::query()->where('code', 'in_progress')->firstOrFail();
    $workflow = \App\Modules\Workflow\Models\WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();

    // 2 reports in `assigned` (in scope), 1 in `accepted` (out of scope)
    Report::factory()->count(2)->create([
        'department_id' => $dept->id,
        'workflow_id' => $workflow->id,
        'current_status_id' => $assigned->id,
    ]);
    Report::factory()->create([
        'department_id' => $dept->id,
        'workflow_id' => $workflow->id,
        'current_status_id' => $accepted->id,
    ]);
    Report::factory()->create([
        'department_id' => $dept->id,
        'workflow_id' => $workflow->id,
        'current_status_id' => $inProg->id,
    ]);

    Sanctum::actingAs($officer);
    $r = $this->get('/api/v1/department/reports/export?format=csv&status=assigned');
    $r->assertOk();
    $body = $r->streamedContent();
    // header + 2 data rows
    expect(substr_count($body, "\n"))->toBe(3);
});

it('DepartmentReportsExport::build returns 400 JSON for an unsupported format', function (): void {
    $r = DepartmentReportsExport::build('docx', collect(), 'test');
    expect($r->getStatusCode())->toBe(400);
    expect($r->headers->get('content-type'))->toContain('application/json');
});
