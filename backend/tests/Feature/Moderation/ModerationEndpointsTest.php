<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Ward;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\GeographySeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    (new GeographySeeder)->run();
});

if (! function_exists('landReportInPendingModerator')) {
    function landReportInPendingModerator(): Report
    {
        $engine = app(WorkflowEngine::class);

        $definition = WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
        $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
        $report = Report::factory()->create([
            'workflow_id' => $definition->id,
            'current_status_id' => $draft->id,
        ]);

        $d = $engine->evaluate($report, 'submit', null);
        $engine->apply($report, $d, null);
        $report = $report->refresh();

        $system = User::factory()->create();
        $system->assignRole('system');
        $d = $engine->evaluate($report, 'ai_complete', $system);
        $engine->apply($report, $d, $system);
        $report = $report->refresh();

        $d = $engine->evaluate($report, 'moderator_review', $system);
        $engine->apply($report, $d, $system);

        return $report->refresh()->load('status');
    }
}

it('rejects /api/v1/moderator/queue without auth', function (): void {
    $this->getJson('/api/v1/moderator/queue')
        ->assertStatus(401);
});

it('rejects /api/v1/moderator/queue for a citizen', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $this->getJson('/api/v1/moderator/queue')
        ->assertStatus(403);
});

it('returns the queue for a moderator', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $response = $this->getJson('/api/v1/moderator/queue');
    $response->assertStatus(200);
    expect($response->json('data.items'))->toBeArray();
    $ids = collect($response->json('data.items'))->pluck('id')->all();
    expect($ids)->toContain($report->id);
});

it('filters the queue by status code', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    // The report is pending_moderator, so it must appear when filtering for that status...
    $this->getJson('/api/v1/moderator/queue?status=pending_moderator')
        ->assertStatus(200)
        ->assertJsonFragment(['id' => $report->id]);

    // ...and must NOT appear when filtering for a different open status.
    $response = $this->getJson('/api/v1/moderator/queue?status=escalated');
    $response->assertStatus(200);
    expect(collect($response->json('data.items'))->pluck('id')->all())->not->toContain($report->id);

    // A status with no matching reports returns an empty list rather than the whole queue.
    $this->getJson('/api/v1/moderator/queue?status=ai_processing')
        ->assertStatus(200)
        ->assertJsonCount(0, 'data.items');
});

it('filters the queue by ward, category, and confidence', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $pothole = ReportType::query()->where('code', 'pothole')->firstOrFail();
    $garbage = ReportType::query()->where('code', 'garbage')->firstOrFail();
    $ward12 = Ward::query()->where('ward_number', 12)->firstOrFail();
    $ward50 = Ward::query()->where('ward_number', 50)->firstOrFail();

    $loc12 = Location::factory()->create(['ward_id' => $ward12->id]);
    $loc50 = Location::factory()->create(['ward_id' => $ward50->id]);

    $match = landReportInPendingModerator();
    $match->report_type_id = $pothole->id;
    $match->location_id = $loc12->id;
    $match->ai_confidence = 85.0;
    $match->save();

    $other = landReportInPendingModerator();
    $other->report_type_id = $garbage->id;
    $other->location_id = $loc50->id;
    $other->ai_confidence = 45.0;
    $other->save();

    $idsFor = fn (string $url): array => collect(
        $this->getJson($url)->assertStatus(200)->json('data.items')
    )->pluck('id')->all();

    // Ward filter accepts bare numbers and "W-12" style.
    expect($idsFor('/api/v1/moderator/queue?ward=W-12'))->toContain($match->id)
        ->and($idsFor('/api/v1/moderator/queue?ward=W-12'))->not->toContain($other->id)
        ->and($idsFor('/api/v1/moderator/queue?ward=12'))->toContain($match->id);

    // Category filter resolves report-type code to id.
    expect($idsFor('/api/v1/moderator/queue?category=pothole'))->toContain($match->id)
        ->and($idsFor('/api/v1/moderator/queue?category=pothole'))->not->toContain($other->id);

    // Confidence filter works for non-zero and zero minimums.
    expect($idsFor('/api/v1/moderator/queue?confidence_min=80'))->toContain($match->id)
        ->and($idsFor('/api/v1/moderator/queue?confidence_min=80'))->not->toContain($other->id)
        ->and($idsFor('/api/v1/moderator/queue?confidence_min=0'))->toContain($match->id)
        ->and($idsFor('/api/v1/moderator/queue?confidence_min=90'))->not->toContain($match->id);

    // Combined filters narrow the result.
    expect($idsFor('/api/v1/moderator/queue?category=pothole&ward=12&confidence_min=80'))->toContain($match->id)
        ->and($idsFor('/api/v1/moderator/queue?category=pothole&ward=12&confidence_min=80'))->not->toContain($other->id);
});

it('returns the duplicate queue when duplicate_score is set', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();
    $report->duplicate_score = 85.0;
    $report->save();

    $response = $this->getJson('/api/v1/moderator/duplicates');
    $response->assertStatus(200);
    $ids = collect($response->json('data.items'))->pluck('id')->all();
    expect($ids)->toContain($report->id);
});

it('returns the fraud queue when fraud_score is set', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();
    $report->fraud_score = 80.0;
    $report->save();

    $response = $this->getJson('/api/v1/moderator/fraud');
    $response->assertStatus(200);
    $ids = collect($response->json('data.items'))->pluck('id')->all();
    expect($ids)->toContain($report->id);
});

it('returns the report detail for a moderator', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $response = $this->getJson("/api/v1/moderator/reports/{$report->id}");
    $response->assertStatus(200);
    expect($response->json('data.report.id'))->toBe($report->id);
});

it('returns the moderation analytics summary for a moderator', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();
    $report->duplicate_score = 85.0;
    $report->fraud_score = 80.0;
    $report->save();

    $response = $this->getJson('/api/v1/moderator/analytics/summary');
    $response->assertOk();
    expect($response->json('data'))->toHaveKeys([
        'pending_moderator',
        'duplicates_pending',
        'fraud_pending',
        'approved_today',
        'rejected_today',
        'merged_today',
        'escalated_today',
        'avg_review_minutes',
        'ai_accuracy_pct',
    ]);
});

it('returns moderator ai performance analytics', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $response = $this->getJson('/api/v1/moderator/analytics/ai-performance?window=7d');
    $response->assertOk();
    expect($response->json('data'))->toHaveKeys([
        'window',
        'total_ai_decisions',
        'overridden_by_moderator',
        'override_rate_pct',
        'per_provider',
    ]);
});

it('the review endpoint applies an approve decision', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $response = $this->postJson("/api/v1/moderator/reports/{$report->id}/review", [
        'decision' => 'approve',
        'remarks' => 'Looks good.',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.report.status.code'))->toBe('assigned');
});

it('the review endpoint rejects an unknown decision with 422', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $this->postJson("/api/v1/moderator/reports/{$report->id}/review", [
        'decision' => 'archive',
    ])->assertStatus(422);
});

it('the reject shortcut endpoint works', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $response = $this->postJson("/api/v1/moderator/reports/{$report->id}/reject", [
        'remarks' => 'Duplicate of an existing report.',
        'reason_code' => 'duplicate',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.report.status.code'))->toBe('rejected');
});

it('the escalate shortcut endpoint works', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $report = landReportInPendingModerator();

    $response = $this->postJson("/api/v1/moderator/reports/{$report->id}/escalate", [
        'remarks' => 'AI fraud score 0.91 — needs senior review.',
        'reason_code' => 'high_fraud_score',
        'override_ai' => true,
    ]);

    $response->assertStatus(200);
    expect($response->json('data.report.status.code'))->toBe('escalated');
});

it('the merge bulk endpoint folds duplicates into the canonical', function (): void {
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');
    Sanctum::actingAs($moderator);

    $canonical = landReportInPendingModerator();
    $dup1 = landReportInPendingModerator();
    $dup2 = landReportInPendingModerator();

    $response = $this->postJson("/api/v1/moderator/reports/{$canonical->id}/merge", [
        'duplicate_report_ids' => [$dup1->id, $dup2->id],
        'reason_code' => 'duplicate',
        'remarks' => 'Same pothole.',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.merged_count'))->toBe(2);

    $mergedStatus = ReportStatus::query()->where('code', 'merged')->firstOrFail();
    expect($dup1->fresh()->current_status_id)->toBe($mergedStatus->id);
    expect($dup2->fresh()->current_status_id)->toBe($mergedStatus->id);
});

it('a citizen is denied every moderation endpoint', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);

    $report = landReportInPendingModerator();

    $this->getJson('/api/v1/moderator/queue')->assertStatus(403);
    $this->getJson('/api/v1/moderator/duplicates')->assertStatus(403);
    $this->getJson('/api/v1/moderator/fraud')->assertStatus(403);
    $this->getJson('/api/v1/moderator/analytics/summary')->assertStatus(403);
    $this->getJson('/api/v1/moderator/analytics/ai-performance')->assertStatus(403);
    $this->getJson("/api/v1/moderator/reports/{$report->id}")->assertStatus(403);
    $this->postJson("/api/v1/moderator/reports/{$report->id}/review", ['decision' => 'approve', 'remarks' => 'hi'])->assertStatus(403);
    $this->postJson("/api/v1/moderator/reports/{$report->id}/reject", ['decision' => 'reject', 'remarks' => 'hi'])->assertStatus(403);
    $this->postJson("/api/v1/moderator/reports/{$report->id}/escalate", ['decision' => 'escalate', 'remarks' => 'hi'])->assertStatus(403);
    $this->postJson("/api/v1/moderator/reports/{$report->id}/merge", ['duplicate_report_ids' => ['019f0000-0000-7000-8000-000000000001']])->assertStatus(403);
});
