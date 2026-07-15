<?php

declare(strict_types=1);

use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds all 13 report status lifecycle codes', function (): void {
    (new ReportStatusesSeeder)->run();

    foreach (['draft', 'submitted', 'ai_processing', 'pending_moderator', 'assigned',
        'accepted', 'in_progress', 'resolved', 'verified', 'closed', 'rejected'] as $code) {
        expect(ReportStatus::query()->where('code', $code)->exists())->toBeTrue("missing status: {$code}");
    }
    expect(ReportStatus::query()->count())->toBe(13);
});

it('seeds the 5 priority levels with sensible SLAs', function (): void {
    (new ReportPrioritiesSeeder)->run();

    expect(ReportPriority::query()->count())->toBe(5);

    $emergency = ReportPriority::query()->where('code', 'emergency')->firstOrFail();
    $low = ReportPriority::query()->where('code', 'low')->firstOrFail();

    expect($emergency->sla_minutes)->toBeLessThanOrEqual(60)
        ->and($low->sla_minutes)->toBeGreaterThanOrEqual(7 * 24 * 60);
});

it('seeds the 10 default report types with a required photo and optional video', function (): void {
    (new ReportTypesSeeder)->run();

    expect(ReportType::query()->count())->toBe(10);
    expect(ReportType::query()->where('code', 'pothole')->exists())->toBeTrue()
        ->and(ReportType::query()->where('code', 'garbage')->exists())->toBeTrue();

    ReportType::query()->each(function (ReportType $type): void {
        expect($type->requires_photo)->toBeTrue()
            ->and($type->requires_video)->toBeFalse()
            ->and($type->min_photos)->toBeGreaterThanOrEqual(1)
            ->and($type->max_photos)->toBeGreaterThan($type->min_photos);
    });
});

it('is idempotent — re-running each seeder does not duplicate rows', function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportStatusesSeeder)->run();
    expect(ReportStatus::query()->count())->toBe(13);

    (new ReportPrioritiesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    expect(ReportPriority::query()->count())->toBe(5);

    (new ReportTypesSeeder)->run();
    (new ReportTypesSeeder)->run();
    expect(ReportType::query()->count())->toBe(10);
});
