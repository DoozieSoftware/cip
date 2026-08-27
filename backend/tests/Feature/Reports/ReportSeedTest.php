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

it('seeds the 8 active Bengaluru complaint categories with a required photo and optional video', function (): void {
    (new ReportTypesSeeder)->run();

    // The three waste streams are collected through the Dr. Linen partner
    // service (/citizen -> "Request pickup"), so they are seeded inactive and
    // are never offered as complaint categories. The rows are kept, not
    // deleted, so historical reports retain their category.
    expect(ReportType::query()->where('active', true)->count())->toBe(8);
    expect(ReportType::query()->where('active', true)->where('code', 'roads')->exists())->toBeTrue()
        ->and(ReportType::query()->where('active', true)->where('code', 'garbage')->exists())->toBeTrue()
        ->and(ReportType::query()->where('active', true)->where('code', 'traffic_violation')->exists())->toBeTrue()
        ->and(ReportType::query()->where('active', true)->where('code', 'pothole')->exists())->toBeFalse();

    foreach (['clothes_waste', 'metal_scrap', 'e_waste'] as $code) {
        expect(ReportType::query()->where('code', $code)->exists())->toBeTrue("missing retired stream: {$code}")
            ->and(ReportType::query()->where('active', true)->where('code', $code)->exists())
            ->toBeFalse("retired collection stream is still an active category: {$code}");
    }

    ReportType::query()->where('active', true)->each(function (ReportType $type): void {
        expect($type->requires_photo)->toBeTrue()
            ->and($type->requires_video)->toBeFalse()
            ->and($type->min_photos)->toBeGreaterThanOrEqual(1)
            ->and($type->max_photos)->toBeGreaterThan($type->min_photos);
    });
});

it('seeds Kannada localizations and search aliases on the waste-stream categories', function (): void {
    (new ReportTypesSeeder)->run();

    $clothes = ReportType::query()->where('code', 'clothes_waste')->firstOrFail();
    expect($clothes->name)->toBe('Clothes & Textiles')
        ->and($clothes->localizations)->toBe(['kn-IN' => 'ಬಟ್ಟೆಗಳು ಮತ್ತು ಜವಳಿ'])
        ->and($clothes->aliases)->toBe(['old clothes', 'clothes donation', 'textiles', 'ಬಟ್ಟೆ'])
        ->and($clothes->sort_order)->toBe(9)
        ->and($clothes->response_target_minutes)->toBe(2880)
        ->and($clothes->department_default_id)->toBeNull();

    $metal = ReportType::query()->where('code', 'metal_scrap')->firstOrFail();
    expect($metal->name)->toBe('Metal Scrap')
        ->and($metal->localizations)->toBe(['kn-IN' => 'ಲೋಹದ ಸ್ಕ್ರ್ಯಾಪ್'])
        ->and($metal->aliases)->toBe(['scrap metal', 'loha', 'ಸ್ಕ್ರ್ಯಾಪ್'])
        ->and($metal->sort_order)->toBe(10)
        ->and($metal->response_target_minutes)->toBe(2880)
        ->and($metal->department_default_id)->toBeNull();

    $ewaste = ReportType::query()->where('code', 'e_waste')->firstOrFail();
    expect($ewaste->name)->toBe('Electronic Waste (E-Waste)')
        ->and($ewaste->localizations)->toBe(['kn-IN' => 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ತ್ಯಾಜ್ಯ (ಇ-ವೇಸ್ಟ್)'])
        ->and($ewaste->aliases)->toBe(['e-waste', 'ewaste', 'electronics', 'computer'])
        ->and($ewaste->sort_order)->toBe(11)
        ->and($ewaste->response_target_minutes)->toBe(2880)
        ->and($ewaste->department_default_id)->toBeNull();
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
    expect(ReportType::query()->where('active', true)->count())->toBe(11);
});
