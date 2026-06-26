<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    // Reset rate-limiter buckets between tests so the citizen 60/min
    // cap does not bleed across tests.
    RateLimiter::clear('citizen:'.request()?->ip() ?? '127.0.0.1');
});

it('citizen can submit a new report end-to-end', function (): void {
    $citizen = User::factory()->create();
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

    $response = $this->postJson('/api/v1/reports', $payload);

    $response->assertStatus(201);
    expect($response->json('data.tracking_number'))->toStartWith('CIV-'.date('Y').'-')
        ->and($response->json('data.status.code'))->toBe('submitted');

    $this->assertDatabaseHas('reports', [
        'citizen_id' => $citizen->id,
        'title' => 'Pothole on MG Road',
    ]);
    $this->assertDatabaseCount('report_status_history', 1);
});

it('citizen can submit a draft then move it to submitted via the 2-step endpoint', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $type = ReportType::query()->where('code', 'pothole')->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->where('code', 'medium')->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $citizen->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'Manual draft',
        'description' => 'Created directly so we can test the submit endpoint.',
    ]);

    $response = $this->postJson("/api/v1/reports/{$report->id}/submit");

    $response->assertOk();
    expect($response->json('data.status.code'))->toBe('submitted');
});

it('rejects unauthenticated submit with 401', function (): void {
    $type = ReportType::query()->firstOrFail();
    $payload = [
        'report_type_id' => $type->id,
        'title' => 'Anon pothole report',
        'description' => 'Reported without auth.',
        'latitude' => 12.9,
        'longitude' => 77.6,
    ];

    $this->postJson('/api/v1/reports', $payload)->assertStatus(401);
});

it('rejects payload with out-of-range latitude with 422', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->firstOrFail();

    $this->postJson('/api/v1/reports', [
        'report_type_id' => $type->id,
        'title' => 'Bad lat report',
        'description' => 'Latitude is 95 degrees.',
        'latitude' => 95.0,
        'longitude' => 0.0,
    ])->assertStatus(422);
});

it('citizen dashboard returns total / open / resolved / rejected counts', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $resolved = ReportStatus::query()->where('code', 'resolved')->firstOrFail();
    $rejected = ReportStatus::query()->where('code', 'rejected')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();

    foreach ([$draft, $submitted, $resolved, $rejected] as $st) {
        Report::query()->create([
            'citizen_id' => $citizen->id,
            'report_type_id' => $type->id,
            'current_status_id' => $st->id,
            'priority_id' => $priority->id,
            'location_id' => Location::factory()->create()->id,
            'title' => 'row',
            'description' => 'row',
        ]);
    }

    $response = $this->getJson('/api/v1/citizen/dashboard');
    $response->assertOk();
    $data = $response->json('data');
    expect($data['total'])->toBe(4)
        ->and($data['open'])->toBe(1)    // submitted only — draft is its own bucket
        ->and($data['resolved'])->toBe(1)
        ->and($data['rejected'])->toBe(1);
});

it('citizen can list their own reports and excludes other citizens', function (): void {
    $alice = User::factory()->create();
    $bob = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();

    foreach ([$alice, $bob] as $u) {
        Report::query()->create([
            'citizen_id' => $u->id,
            'report_type_id' => $type->id,
            'current_status_id' => $draft->id,
            'priority_id' => $priority->id,
            'location_id' => Location::factory()->create()->id,
            'title' => 'row',
            'description' => 'row',
        ]);
    }

    Sanctum::actingAs($alice);
    $response = $this->getJson('/api/v1/citizen/reports');
    $response->assertOk();
    expect(count($response->json('data')))->toBe(1);
});

it('citizen cannot view another citizen report via /citizen/reports/{id}', function (): void {
    $alice = User::factory()->create();
    $bob = User::factory()->create();
    $type = ReportType::query()->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();
    $report = Report::query()->create([
        'citizen_id' => $bob->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => Location::factory()->create()->id,
        'title' => 'bobs',
        'description' => 'bobs',
    ]);

    Sanctum::actingAs($alice);
    $this->getJson("/api/v1/citizen/reports/{$report->id}")->assertStatus(403);
});

it('staff can read any report via /reports/{id}', function (): void {
    $citizen = User::factory()->create();
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    $type = ReportType::query()->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();
    $report = Report::query()->create([
        'citizen_id' => $citizen->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => Location::factory()->create()->id,
        'title' => 'row',
        'description' => 'row',
    ]);

    Sanctum::actingAs($moderator);
    $response = $this->getJson("/api/v1/reports/{$report->id}");
    $response->assertOk();
    expect($response->json('data.id'))->toBe($report->id);
});

it('staff can read the timeline', function (): void {
    $citizen = User::factory()->create();
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    $type = ReportType::query()->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $priority = ReportPriority::query()->firstOrFail();
    $location = Location::factory()->create();
    $report = Report::query()->create([
        'citizen_id' => $citizen->id,
        'report_type_id' => $type->id,
        'current_status_id' => $draft->id,
        'priority_id' => $priority->id,
        'location_id' => $location->id,
        'title' => 'row',
        'description' => 'row',
    ]);

    Sanctum::actingAs($citizen);
    $this->postJson("/api/v1/reports/{$report->id}/submit")->assertOk();

    Sanctum::actingAs($moderator);
    $response = $this->getJson("/api/v1/reports/{$report->id}/timeline");
    $response->assertOk();
    expect(count($response->json('data')))->toBe(1);
});
