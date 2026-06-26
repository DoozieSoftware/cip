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
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
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

    expect($report->submitted_at)->not->toBeNull()
        ->and($report->status->code)->toBe('submitted')
        ->and(ReportStatusHistory::query()->where('report_id', $report->id)->count())->toBe(1);
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
    $submittedId = ReportStatus::query()->where('code', 'submitted')->value('id');
    $before = ReportStatusHistory::query()->where('report_id', $report->id)->count();
    $svc->transitionTo($report, $submittedId, $citizen->id, 'no-op');
    expect(ReportStatusHistory::query()->where('report_id', $report->id)->count())->toBe($before);
});
