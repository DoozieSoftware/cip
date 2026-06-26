<?php

declare(strict_types=1);

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Services\ReportService;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('anchors the submitted report to the default civic workflow', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $report = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: 'Right outside my house.',
    ));

    expect($report->workflow_id)->not->toBeNull()
        ->and(WorkflowDefinition::query()->where('id', $report->workflow_id)->value('code'))
        ->toBe('civic_default');
});

it('submit drives draft to submitted through the workflow engine', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $report = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: 'Right outside my house.',
    ));

    expect($report->status->code)->toBe('submitted')
        ->and($report->submitted_at)->not->toBeNull();
});

it('submit writes exactly one report_status_history row via the engine', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $report = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: 'Right outside my house.',
    ));

    $rows = ReportStatusHistory::query()->where('report_id', $report->id)->get();

    expect($rows)->toHaveCount(1)
        ->and($rows->first()->from_status_id)->not->toBe($rows->first()->to_status_id);

    $submittedId = ReportStatus::query()->where('code', 'submitted')->value('id');
    expect($rows->first()->to_status_id)->toBe($submittedId);
});

it('submit persists the current_status_id matching the submitted report_status row', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $report = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: 'Right outside my house.',
    ));

    $submittedId = ReportStatus::query()->where('code', 'submitted')->value('id');
    expect((string) $report->current_status_id)->toBe((string) $submittedId);
});

it('submit creates a new report per call; each lands in submitted', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $first = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: 'Right outside my house.',
    ));

    $second = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Another',
        description: 'Different report entirely.',
    ));

    expect($second->id)->not->toBe($first->id)
        ->and($second->status->code)->toBe('submitted')
        ->and(Report::query()->where('id', $first->id)->firstOrFail()->status->code)->toBe('submitted');
});
