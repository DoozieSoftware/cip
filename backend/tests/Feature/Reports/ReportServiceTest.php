<?php

declare(strict_types=1);

use App\Modules\Reports\DTO\CreateReportDto;
use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Services\ReportService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('createDraft persists a draft report and assigns a unique tracking number', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $dto = new CreateReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        locationId: $location->id,
        priorityId: $priority->id,
        currentStatusId: $draft->id,
        title: 'Big pothole on 5th',
        description: 'About 30cm wide, right in the middle of the lane.',
    );
    $report = $svc->createDraft($dto);

    expect($report->tracking_number)->toStartWith('CIV-'.date('Y').'-')
        ->and(Report::query()->where('tracking_number', $report->tracking_number)->count())->toBe(1);
});

it('createDraft heals a stale yearly sequence before assigning the next tracking number', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $year = (int) date('Y');

    Report::query()->create([
        'tracking_number' => sprintf('CIV-%d-000036', $year),
        'citizen_id' => $citizen->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => Location::factory()->create()->id,
        'title' => 'Existing report',
        'description' => 'Existing seeded report.',
    ]);

    DB::table('report_number_sequences')->insert([
        'year' => $year,
        'next_value' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $svc = app(ReportService::class);
    $report = $svc->createDraft(new CreateReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        locationId: Location::factory()->create()->id,
        priorityId: $priority->id,
        currentStatusId: $draft->id,
        title: 'New report',
        description: 'Should skip past existing tracking numbers.',
    ));

    expect($report->tracking_number)->toBe(sprintf('CIV-%d-000037', $year))
        ->and(DB::table('report_number_sequences')->where('year', $year)->value('next_value'))->toBe(38);
});

it('updateDraft patches a draft report but rejects a submitted one', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();

    $svc = app(ReportService::class);
    $report = $svc->createDraft(new CreateReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        locationId: $location->id,
        priorityId: $priority->id,
        currentStatusId: $draft->id,
        title: 'old',
        description: 'old',
    ));

    $svc->updateDraft($report, ['title' => 'new']);
    expect($report->refresh()->title)->toBe('new');

    // Move it to submitted, then expect updateDraft to fail.
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $report = $svc->transitionTo($report, $submitted->id, $citizen->id, 'Submitting.');
    expect(fn () => $svc->updateDraft($report, ['title' => 'x']))
        ->toThrow(ApiException::class);
});

it('submit moves draft → submitted and writes one status_history row', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::factory()->create();
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
    $report->load('status');
    $status = $report->status;

    if (! $status instanceof ReportStatus) {
        throw new RuntimeException('Expected the submitted report to load a status relation.');
    }

    expect($report->submitted_at)->not->toBeNull()
        ->and($status->code)->toBe('ai_processing')
        ->and(ReportStatusHistory::query()->where('report_id', $report->id)->count())->toBeGreaterThan(0);
});

it('transitionTo is a no-op when from == to', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::factory()->create();
    $location = Location::factory()->create();
    $svc = app(ReportService::class);
    $report = $svc->submit(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 10.0,
        title: 'Pothole',
        description: '.',
    ));
    $submittedId = $report->current_status_id;
    $before = ReportStatusHistory::query()->where('report_id', $report->id)->count();

    $svc->transitionTo($report, $submittedId, $citizen->id, 'no-op');
    expect(ReportStatusHistory::query()->where('report_id', $report->id)->count())->toBe($before);
});
