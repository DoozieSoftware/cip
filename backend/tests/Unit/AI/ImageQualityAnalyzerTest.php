<?php

declare(strict_types=1);

use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\Media\Models\Media;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    Storage::fake('local');
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('returns the FLAG_THRESHOLD constant of 50 for the moderator review boundary', function (): void {
    expect(ImageQualityAnalyzer::FLAG_THRESHOLD)->toBe(50);
});

it('scores a clean, large, varied photo above 80', function (): void {
    // 1 MB of pseudo-random bytes — high variance, large size,
    // good resolution.
    Storage::disk('local')->put('evidence/clean.jpg', random_bytes(1_048_576));

    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/clean.jpg',
        'mime' => 'image/jpeg',
        'size' => 1_048_576,
        'width' => 1920,
        'height' => 1080,
    ]);

    $score = (new ImageQualityAnalyzer)->score($media);

    expect($score)->toBeGreaterThan(80)
        ->and((new ImageQualityAnalyzer)->shouldFlagForModerator($score))->toBeFalse();
});

it('scores a solid black image at or near 0', function (): void {
    // 4 KB of the same byte — zero variance.
    Storage::disk('local')->put('evidence/black.jpg', str_repeat("\x00", 4096));

    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/black.jpg',
        'mime' => 'image/jpeg',
        'size' => 4096,
        'width' => 1920,
        'height' => 1080,
    ]);

    $score = (new ImageQualityAnalyzer)->score($media);

    expect($score)->toBeLessThan(50)
        ->and((new ImageQualityAnalyzer)->shouldFlagForModerator($score))->toBeTrue();
});

it('scores a tiny (under 20 KB), tiny-resolution image low', function (): void {
    Storage::disk('local')->put('evidence/tiny.bin', random_bytes(5_000));

    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/tiny.bin',
        'mime' => 'image/jpeg',
        'size' => 5_000,
        'width' => 100,
        'height' => 100,
    ]);

    $score = (new ImageQualityAnalyzer)->score($media);

    expect($score)->toBeLessThan(50)
        ->and((new ImageQualityAnalyzer)->shouldFlagForModerator($score))->toBeTrue();
});

it('returns 70 for VIDEO media (no image heuristic applicable)', function (): void {
    $media = Media::factory()->create([
        'type' => 'VIDEO',
        'mime' => 'video/mp4',
    ]);

    expect((new ImageQualityAnalyzer)->score($media))->toBe(70);
});

it('returns 50 for DOCUMENT media (no image heuristic applicable)', function (): void {
    $media = Media::factory()->create([
        'type' => 'DOCUMENT',
        'mime' => 'application/pdf',
    ]);

    expect((new ImageQualityAnalyzer)->score($media))->toBe(50);
});

it('clamps the score to the 0..100 range even when penalties stack', function (): void {
    Storage::disk('local')->put('evidence/worst.bin', str_repeat("\xff", 100));

    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/worst.bin',
        'mime' => 'image/jpeg',
        'size' => 100,
        'width' => 50,
        'height' => 50,
    ]);

    $score = (new ImageQualityAnalyzer)->score($media);

    expect($score)->toBeGreaterThanOrEqual(0)
        ->and($score)->toBeLessThanOrEqual(100);
});

it('handles a missing storage file gracefully (no exception, low stdev penalty)', function (): void {
    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/does-not-exist.jpg',
        'mime' => 'image/jpeg',
        'size' => 500_000,
        'width' => 1920,
        'height' => 1080,
    ]);

    $score = (new ImageQualityAnalyzer)->score($media);

    expect($score)->toBeInt()
        ->and($score)->toBeGreaterThanOrEqual(0);
});
