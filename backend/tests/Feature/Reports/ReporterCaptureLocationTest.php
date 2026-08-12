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

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

it('preserves reporter GPS separately from a manually selected issue pin', function (): void {
    $citizen = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $capturedAt = new DateTimeImmutable('2026-08-12T08:00:00+05:30');

    $location = app(LocationService::class)->createFromSubmission(new SubmitReportDto(
        citizenId: $citizen->id,
        reportTypeId: $type->id,
        latitude: 12.9816,
        longitude: 77.5946,
        reporterLatitude: 12.9716,
        reporterLongitude: 77.5946,
        reporterAccuracy: 12.0,
        reporterGpsProvider: 'browser_geolocation',
        reporterCapturedAt: $capturedAt,
        gpsProvider: 'manual_pin',
        title: 'Pothole',
        description: 'Large pothole near the signal.',
    ));

    expect($location->latitude)->toBe(12.9816)
        ->and($location->longitude)->toBe(77.5946)
        ->and($location->reporter_latitude)->toBe(12.9716)
        ->and($location->reporter_longitude)->toBe(77.5946)
        ->and($location->reporter_accuracy)->toBe(12.0)
        ->and($location->reporter_gps_provider)->toBe('browser_geolocation')
        ->and($location->reporter_captured_at?->toIso8601String())->toBe($capturedAt->format(DateTimeInterface::ATOM));
});
