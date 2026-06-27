<?php

declare(strict_types=1);

use App\Modules\AI\Services\DuplicateDetector;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Reports\Models\Report;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

beforeEach(function (): void {
    Cache::flush();
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('identical perceptual hash returns score 100', function (): void {
    $hash = 'abcdef1234567890';

    $reportA = Report::factory()->create();
    $mediaA = Media::factory()->create(['report_id' => $reportA->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaA->id,
        'sha256' => str_repeat('a', 64),
        'sha512' => str_repeat('b', 128),
        'perceptual_hash' => $hash,
        'created_at' => now(),
    ]);

    $reportB = Report::factory()->create();
    $mediaB = Media::factory()->create(['report_id' => $reportB->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaB->id,
        'sha256' => str_repeat('c', 64),
        'sha512' => str_repeat('d', 128),
        'perceptual_hash' => $hash,
        'created_at' => now(),
    ]);

    $det = new DuplicateDetector;
    $result = $det->detect($reportA);

    expect($result['score'])->toBe(100)
        ->and($result['matched_report_id'])->toBe($reportB->id)
        ->and($result['reason'])->toContain('perceptual_hamming=0');
});

it('hamming distance > 5 returns score 0', function (): void {
    $reportA = Report::factory()->create();
    $mediaA = Media::factory()->create(['report_id' => $reportA->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaA->id,
        'sha256' => str_repeat('a', 64),
        'sha512' => str_repeat('b', 128),
        'perceptual_hash' => '0000000000000000',
        'created_at' => now(),
    ]);

    $reportB = Report::factory()->create();
    $mediaB = Media::factory()->create(['report_id' => $reportB->id]);
    // Every nibble is different from 0 → 16*4 = 64 hamming distance.
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaB->id,
        'sha256' => str_repeat('c', 64),
        'sha512' => str_repeat('d', 128),
        'perceptual_hash' => 'ffffffffffffffff',
        'created_at' => now(),
    ]);

    $result = (new DuplicateDetector)->detect($reportA);

    expect($result['score'])->toBe(0)
        ->and($result['matched_report_id'])->toBeNull()
        ->and($result['reason'])->toBe('no_match');
});

it('a 2-nibble (8-bit) difference yields a mid-range score', function (): void {
    $reportA = Report::factory()->create();
    $mediaA = Media::factory()->create(['report_id' => $reportA->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaA->id,
        'sha256' => str_repeat('a', 64),
        'sha512' => str_repeat('b', 128),
        'perceptual_hash' => '0000000000000000',
        'created_at' => now(),
    ]);

    $reportB = Report::factory()->create();
    $mediaB = Media::factory()->create(['report_id' => $reportB->id]);
    // 1 nibble differs in 2 chars (8 bits set) → distance=8, > threshold.
    // Use 1 nibble in 1 char (4 bits) → distance=4, within threshold.
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaB->id,
        'sha256' => str_repeat('c', 64),
        'sha512' => str_repeat('d', 128),
        'perceptual_hash' => '1000000000000000', // 1 nibble differs
        'created_at' => now(),
    ]);

    $result = (new DuplicateDetector)->detect($reportA);

    expect($result['score'])->toBeGreaterThan(0)
        ->and($result['score'])->toBeLessThanOrEqual(100)
        ->and($result['matched_report_id'])->toBe($reportB->id);
});

it('returns no_match when the report has no media', function (): void {
    $report = Report::factory()->create();

    $result = (new DuplicateDetector)->detect($report);

    expect($result['score'])->toBe(0)
        ->and($result['reason'])->toBe('no_media');
});

it('returns no_match when the media has no hash row', function (): void {
    $report = Report::factory()->create();
    Media::factory()->create(['report_id' => $report->id]);

    $result = (new DuplicateDetector)->detect($report);

    expect($result['score'])->toBe(0)
        ->and($result['reason'])->toBe('no_hash');
});

it('ignores candidates outside the 7-day window', function (): void {
    $hash = 'aabbccddeeff0011';

    $reportA = Report::factory()->create();
    $mediaA = Media::factory()->create(['report_id' => $reportA->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaA->id,
        'sha256' => str_repeat('a', 64),
        'sha512' => str_repeat('b', 128),
        'perceptual_hash' => $hash,
        'created_at' => now(),
    ]);

    $reportB = Report::factory()->create(['created_at' => now()->subDays(30)]);
    $mediaB = Media::factory()->create(['report_id' => $reportB->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaB->id,
        'sha256' => str_repeat('c', 64),
        'sha512' => str_repeat('d', 128),
        'perceptual_hash' => $hash,
        'created_at' => now()->subDays(30),
    ]);

    $result = (new DuplicateDetector)->detect($reportA);

    expect($result['score'])->toBe(0)
        ->and($result['reason'])->toBe('no_match');
});

it('score() is a shorthand for detect()[\'score\']', function (): void {
    $reportA = Report::factory()->create();
    $mediaA = Media::factory()->create(['report_id' => $reportA->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaA->id,
        'sha256' => str_repeat('a', 64),
        'sha512' => str_repeat('b', 128),
        'perceptual_hash' => '0000000000000000',
        'created_at' => now(),
    ]);

    $reportB = Report::factory()->create();
    $mediaB = Media::factory()->create(['report_id' => $reportB->id]);
    MediaHash::query()->create([
        'id' => (string) Str::uuid(),
        'media_id' => $mediaB->id,
        'sha256' => str_repeat('c', 64),
        'sha512' => str_repeat('d', 128),
        'perceptual_hash' => '0000000000000000',
        'created_at' => now(),
    ]);

    expect((new DuplicateDetector)->score($reportA))->toBe(100);
});
