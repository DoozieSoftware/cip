<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Services\SystemUserService;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
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

it('POST /internal/ai/process enqueues the pipeline and returns 202', function (): void {
    $report = Report::factory()->create();
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $resp = $this->postJson('/api/v1/internal/ai/process/'.$report->id);

    $resp->assertStatus(202)
        ->assertJson(['status' => 'queued', 'report_id' => $report->id]);

    Bus::assertDispatched(AiPipelineOrchestrator::class, fn ($j) => $j->reportId === $report->id);
});

it('GET /internal/ai/job/{id} returns 200 with the job fields', function (): void {
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $cfg = AiProviderConfig::query()->create([
        'code' => 'mock', 'name' => 'Mock', 'base_url' => 'http://x', 'auth_type' => 'none',
        'model' => 'm', 'temperature' => 0.2, 'timeout_ms' => 5000, 'retry_count' => 1,
        'is_fallback' => false, 'priority' => 1, 'active' => true,
    ]);
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
        ->assertJsonPath('data.id', $job->id)->assertJsonPath('data.status', 'queued');
});

it('GET /internal/ai/job/{id} returns 404 for missing job', function (): void {
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $this->getJson('/api/v1/internal/ai/job/00000000-0000-0000-0000-000000000000')
        ->assertNotFound();
});

it('GET /internal/ai/job/{id}/result returns 200 with result + labels', function (): void {
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
        ->assertJsonPath('data.predicted_type', 'pothole')->assertJsonPath('data.severity', 'high')
        ->assertJsonPath('data.labels.0.label', 'pothole')
        ->assertJsonPath('data.labels.0.is_primary', true);
});

it('GET /internal/ai/job/{id}/result returns 404 when result not yet produced', function (): void {
    Sanctum::actingAs(app(SystemUserService::class)->user(), ['*']);

    $pv = PromptVersion::query()->create([
        'name' => 'z', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'z', 'expected_json_schema' => null, 'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => Report::factory()->create()->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'mock', 'model' => 'm', 'status' => 'running',
        'requested_at' => now(), 'started_at' => now(), 'retry_count' => 0,
    ]);

    $this->getJson('/api/v1/internal/ai/job/'.$job->id.'/result')
        ->assertNotFound();
});
