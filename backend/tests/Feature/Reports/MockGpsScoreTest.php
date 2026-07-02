<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * The citizen PWA's client-side mock-GPS heuristic (0..1) is stored
 * on `reports.mock_gps_score` at submit time and surfaced to the
 * moderator — it never auto-rejects a report on its own.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    RateLimiter::clear('citizen:'.request()?->ip() ?? '127.0.0.1');
});

function submitReportWithGpsScore(User $citizen, ?float $score): TestResponse
{
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->where('code', 'pothole')->firstOrFail();

    $payload = [
        'report_type_id' => $type->id,
        'title' => 'Pothole on MG Road',
        'description' => 'A large pothole near the signal.',
        'is_anonymous' => false,
        'latitude' => 12.9716,
        'longitude' => 77.5946,
        'accuracy' => 8.0,
    ];

    if ($score !== null) {
        $payload['mock_gps_score'] = $score;
    }

    return test()->postJson('/api/v1/reports', $payload);
}

it('persists mock_gps_score on the report and surfaces it in the API response', function (): void {
    $citizen = User::factory()->create();

    $response = submitReportWithGpsScore($citizen, 0.73);

    $response->assertStatus(201)->assertJsonPath('data.mock_gps_score', 0.73);

    $report = Report::query()->where('citizen_id', $citizen->id)->firstOrFail();
    expect($report->mock_gps_score)->toBe(0.73);
});

it('never rejects the submission regardless of how high the score is', function (): void {
    $citizen = User::factory()->create();

    // A near-certain mock-GPS score still succeeds — the platform
    // never auto-rejects on this signal alone.
    submitReportWithGpsScore($citizen, 0.99)->assertStatus(201);
});

it('records a mock_gps security event when the score crosses the likely threshold (>= 0.5)', function (): void {
    $citizen = User::factory()->create();

    submitReportWithGpsScore($citizen, 0.6)->assertStatus(201);

    expect(SecurityEvent::query()->where('event', 'mock_gps')->count())->toBe(1);
    $event = SecurityEvent::query()->where('event', 'mock_gps')->firstOrFail();
    expect($event->metadata['score'])->toBe(0.6)
        ->and($event->user_id)->toBe($citizen->id);
});

it('does not record a security event below the likely threshold', function (): void {
    $citizen = User::factory()->create();

    submitReportWithGpsScore($citizen, 0.2)->assertStatus(201);

    expect(SecurityEvent::query()->where('event', 'mock_gps')->count())->toBe(0);
});

it('leaves mock_gps_score null when the client sends nothing (older clients, no false signal)', function (): void {
    $citizen = User::factory()->create();

    $response = submitReportWithGpsScore($citizen, null);

    $response->assertStatus(201)->assertJsonPath('data.mock_gps_score', null);
    expect(SecurityEvent::query()->where('event', 'mock_gps')->count())->toBe(0);
});

it('rejects an out-of-range mock_gps_score with 422', function (): void {
    $citizen = User::factory()->create();

    submitReportWithGpsScore($citizen, 1.5)->assertStatus(422);
});
