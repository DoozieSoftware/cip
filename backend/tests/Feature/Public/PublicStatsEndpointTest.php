<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\Yaml\Yaml;

uses(RefreshDatabase::class);

/**
 * GET /api/v1/public/stats — unauthenticated landing-page stats.
 * Replaces the hardcoded `{ '12,847', '94%', '38s' }` array that
 * used to live directly in LandingPage.tsx.
 */
beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    Cache::flush();
});

it('requires no authentication', function (): void {
    $this->getJson('/api/v1/public/stats')->assertOk();
});

it('returns zero-safe defaults when there is no data', function (): void {
    $response = $this->getJson('/api/v1/public/stats');

    // PHP's json_encode drops the trailing .0 on a whole-number float,
    // so the wire value is the JSON integer 0, not 0.0.
    $response->assertOk()->assertJsonPath('data.total_reports', 0)
        ->assertJsonPath('data.ai_classified_percent', 0)
        ->assertJsonPath('data.median_assign_seconds', null);
});

it('counts total reports and computes the AI-classified percentage to one decimal place', function (): void {
    // 2 of 3 classified = 66.7% — a non-whole percentage exercises the
    // round(..., 1) behaviour (a whole-number result like 75.0 would
    // serialise as the JSON integer 75, masking a rounding bug).
    Report::factory()->count(2)->create(['ai_label' => 'pothole']);
    Report::factory()->count(1)->create(['ai_label' => null]);

    $response = $this->getJson('/api/v1/public/stats');

    $response->assertOk()
        ->assertJsonPath('data.total_reports', 3)
        ->assertJsonPath('data.ai_classified_percent', 66.7);
});

it('computes the median submitted->assigned delta from report_status_history', function (): void {
    $submittedId = ReportStatus::query()->where('code', 'submitted')->value('id');
    $assignedId = ReportStatus::query()->where('code', 'assigned')->value('id');

    // Three reports: 60s, 120s, 180s to assign. Median = 120s.
    foreach ([60, 120, 180] as $seconds) {
        $report = Report::factory()->create();
        $submittedAt = Carbon::now()->subMinutes(30);

        ReportStatusHistory::query()->create([
            'report_id' => $report->id,
            'from_status_id' => null,
            'to_status_id' => $submittedId,
            'created_at' => $submittedAt,
        ]);
        ReportStatusHistory::query()->create([
            'report_id' => $report->id,
            'from_status_id' => $submittedId,
            'to_status_id' => $assignedId,
            'created_at' => $submittedAt->copy()->addSeconds($seconds),
        ]);
    }

    $response = $this->getJson('/api/v1/public/stats');

    $response->assertOk()->assertJsonPath('data.median_assign_seconds', 120);
});

it('caches the result for 5 minutes — a second call does not re-query', function (): void {
    Report::factory()->count(2)->create();

    $first = $this->getJson('/api/v1/public/stats')->json('data');

    // Add more reports; the cached response must not change yet.
    Report::factory()->count(5)->create();

    $second = $this->getJson('/api/v1/public/stats')->json('data');

    expect($second['total_reports'])->toBe($first['total_reports']);
});

it('never exposes PII or exact coordinates — only aggregate counts', function (): void {
    Report::factory()->create();

    $response = $this->getJson('/api/v1/public/stats');
    $data = $response->json('data');

    expect(array_keys($data))->toEqualCanonicalizing([
        'total_reports', 'ai_classified_percent', 'median_assign_seconds',
    ]);
});

it('is documented in the OpenAPI spec under the Public tag', function (): void {
    $yaml = Yaml::parseFile(storage_path('api-docs/openapi.yaml'));

    expect(array_keys($yaml['paths']))->toContain('/api/v1/public/stats')
        ->and($yaml['paths']['/api/v1/public/stats']['get']['tags'])->toContain('Public')
        ->and($yaml['components']['schemas'])->toHaveKey('PublicStatsResponse');
});

it('honors the public rate limiter and returns 429 after 30 calls per minute', function (): void {
    $hit = 0;

    for ($i = 0; $i < 31; $i++) {
        $resp = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.42'])
            ->getJson('/api/v1/public/stats');
        $hit = $resp->status();

        if ($hit === 429) {
            break;
        }
    }

    expect($hit)->toBe(429);
});
