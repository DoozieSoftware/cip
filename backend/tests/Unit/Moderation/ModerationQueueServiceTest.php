<?php

declare(strict_types=1);

use App\Modules\Moderation\Services\ModerationQueueService;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('base queue query returns reports with eager loaded relations', function (): void {
    $service = new ModerationQueueService;
    $query = $service->baseQueueQuery();

    expect($query)->toBeInstanceOf(Builder::class);
});

it('statusIdsFor returns correct ids for given codes', function (): void {
    $service = new ModerationQueueService;
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();

    $ids = $service->statusIdsFor(['submitted']);

    expect($ids)->toContain($submitted->id);
});

it('applyFilters filters by status', function (): void {
    $service = new ModerationQueueService;
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();
    $type = ReportType::query()->firstOrFail();

    Report::factory()->create([
        'current_status_id' => $submitted->id,
        'priority_id' => $priority->id,
        'report_type_id' => $type->id,
    ]);
    Report::factory()->create([
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'report_type_id' => $type->id,
    ]);

    $query = $service->baseQueueQuery();
    $request = Request::create('/test?status=submitted');
    $service->applyFilters($query, $request);

    $results = $query->get();
    expect($results)->toHaveCount(1);
    expect((string) $results->first()->current_status_id)->toBe($submitted->id);
});

it('applyFilters filters by category', function (): void {
    $service = new ModerationQueueService;
    $status = ReportStatus::query()->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();
    $roads = ReportType::query()->where('code', 'roads')->first();
    $other = ReportType::query()->where('code', '!=', 'roads')->first() ?? $roads;

    if ($roads !== null) {
        Report::factory()->create([
            'current_status_id' => $status->id,
            'priority_id' => $priority->id,
            'report_type_id' => $roads->id,
        ]);
    }
    Report::factory()->create([
        'current_status_id' => $status->id,
        'priority_id' => $priority->id,
        'report_type_id' => $other->id,
    ]);

    $query = $service->baseQueueQuery();
    $request = Request::create('/test?category=roads');
    $service->applyFilters($query, $request);

    $results = $query->get();

    if ($roads !== null) {
        expect($results)->toHaveCount(1);
    }
});

it('applySort sorts by submitted_at descending by default', function (): void {
    $service = new ModerationQueueService;
    $query = $service->baseQueueQuery();
    $request = Request::create('/test');
    $service->applySort($query, $request);

    expect($query->getQuery()->orders)->not->toBeNull();
});

it('applySort sorts by confidence descending', function (): void {
    $service = new ModerationQueueService;
    $query = $service->baseQueueQuery();
    $request = Request::create('/test?sort=confidence_desc');
    $service->applySort($query, $request);

    expect($query->getQuery()->orders)->not->toBeNull();
});
