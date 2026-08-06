<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Services\SystemUserService;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Bus::fake([AiPipelineOrchestrator::class]);
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('allows the system role to enqueue AI processing', function (): void {
    $report = Report::factory()->create();
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $this->postJson('/api/v1/internal/ai/process/'.$report->id)
        ->assertStatus(202)
        ->assertJson(['status' => 'queued', 'report_id' => $report->id]);

    Bus::assertDispatched(AiPipelineOrchestrator::class, fn ($j) => $j->reportId === $report->id);
});

it('allows the system role to read an AI job', function (): void {
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $pv = PromptVersion::query()->create([
        'name' => 'x', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'x', 'expected_json_schema' => null, 'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => Report::factory()->create()->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'mock', 'model' => 'm', 'status' => 'queued',
        'requested_at' => now(), 'retry_count' => 0,
    ]);

    $this->getJson('/api/v1/internal/ai/job/'.$job->id)
        ->assertOk()
        ->assertJsonPath('data.id', $job->id);
});

it('allows the system role to read an AI result', function (): void {
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $pv = PromptVersion::query()->create([
        'name' => 'y', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'y', 'expected_json_schema' => null, 'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => Report::factory()->create()->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'mock', 'model' => 'm', 'status' => 'succeeded',
        'requested_at' => now(), 'started_at' => now(), 'completed_at' => now(),
        'processing_time_ms' => 100, 'retry_count' => 0,
    ]);
    $result = AiResult::query()->create([
        'job_id' => $job->id, 'predicted_type' => 'pothole', 'confidence' => 0.9,
        'recommended_department' => 'public_works', 'severity' => 'high',
        'quality_score' => 80, 'duplicate_score' => 0, 'fraud_score' => 0,
        'summary' => 'x', 'raw_response' => ['k' => 'v'], 'created_at' => now(),
    ]);
    AiLabel::query()->create([
        'result_id' => $result->id, 'label' => 'pothole',
        'confidence' => 0.9, 'is_primary' => true, 'created_at' => now(),
    ]);

    $this->getJson('/api/v1/internal/ai/job/'.$job->id.'/result')
        ->assertOk()
        ->assertJsonPath('data.predicted_type', 'pothole');
});

it('blocks a citizen from internal AI endpoints with 403', function (): void {
    $report = Report::factory()->create();
    $citizen = User::factory()->create();
    $citizen->assignRole('citizen');

    $this->actingAs($citizen, 'sanctum')
        ->postJson('/api/v1/internal/ai/process/'.$report->id)
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');

    Bus::assertNotDispatched(AiPipelineOrchestrator::class);
});

it('blocks a moderator from internal AI endpoints with 403', function (): void {
    $report = Report::factory()->create();
    $moderator = User::factory()->create();
    $moderator->assignRole('moderator');

    $this->actingAs($moderator, 'sanctum')
        ->postJson('/api/v1/internal/ai/process/'.$report->id)
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('blocks a super_admin from internal AI endpoints with 403', function (): void {
    $report = Report::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/internal/ai/process/'.$report->id)
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('returns 401 for an unauthenticated caller on internal AI endpoints', function (): void {
    $report = Report::factory()->create();

    $this->postJson('/api/v1/internal/ai/process/'.$report->id)
        ->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});
