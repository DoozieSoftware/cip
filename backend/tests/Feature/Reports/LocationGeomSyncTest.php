<?php

declare(strict_types=1);

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Reports\Services\LocationService;
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

it('syncs locations.geom from latitude and longitude on mysql', function (): void {
    if (DB::connection()->getDriverName() !== 'mysql') {
        expect(true)->toBeTrue();

        return;
    }

    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();

    $location = app(LocationService::class)->createFromSubmission(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 8.0,
        title: 'Pothole',
        description: 'Large pothole near the signal.',
    ));

    $row = DB::selectOne(
        'SELECT ST_AsText(geom) AS wkt FROM locations WHERE id = ?',
        [$location->id],
    );

    expect($row)->not->toBeNull()
        ->and($row->wkt)->toBe('POINT(77.5946 12.9716)');
});
