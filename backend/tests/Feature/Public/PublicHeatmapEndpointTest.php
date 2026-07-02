<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * GET /api/v1/public/heatmap — grid-bucketed report density. Must
 * never leak an individual report's exact coordinates.
 */
beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    Cache::flush();
});

it('requires no authentication', function (): void {
    $this->getJson('/api/v1/public/heatmap')->assertOk();
});

it('buckets reports into a 2-decimal grid instead of exact coordinates', function (): void {
    // Two reports close enough together to land in the same 2-decimal
    // grid cell (~1.1 km) — the exact coordinates must never appear.
    $loc1 = Location::factory()->create(['latitude' => 12.97101, 'longitude' => 77.59101]);
    $loc2 = Location::factory()->create(['latitude' => 12.97199, 'longitude' => 77.59199]);
    Report::factory()->create(['location_id' => $loc1->id]);
    Report::factory()->create(['location_id' => $loc2->id]);

    $response = $this->getJson('/api/v1/public/heatmap');
    $points = $response->json('data.points');

    expect($points)->toHaveCount(1)
        ->and($points[0]['lat'])->toBe(12.97)
        ->and($points[0]['lng'])->toBe(77.59)
        ->and($points[0]['count'])->toBe(2);

    // The exact raw coordinates must not appear anywhere in the response.
    $body = $response->getContent();
    expect($body)->not->toContain('12.97101')
        ->and($body)->not->toContain('77.59101');
});

it('separates reports into distinct cells when far enough apart', function (): void {
    $loc1 = Location::factory()->create(['latitude' => 12.90, 'longitude' => 77.50]);
    $loc2 = Location::factory()->create(['latitude' => 13.10, 'longitude' => 77.70]);
    Report::factory()->create(['location_id' => $loc1->id]);
    Report::factory()->create(['location_id' => $loc2->id]);

    $points = $this->getJson('/api/v1/public/heatmap')->json('data.points');

    expect($points)->toHaveCount(2);
});

it('caches the result for 5 minutes', function (): void {
    $loc = Location::factory()->create();
    Report::factory()->create(['location_id' => $loc->id]);

    $first = $this->getJson('/api/v1/public/heatmap')->json('data.points');

    Location::factory()->count(3)->create()->each(fn ($l) => Report::factory()->create(['location_id' => $l->id]));

    $second = $this->getJson('/api/v1/public/heatmap')->json('data.points');

    expect($second)->toEqual($first);
});
