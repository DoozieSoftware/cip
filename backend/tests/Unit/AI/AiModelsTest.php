<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

it('AiProviderConfig casts boolean, int, and float columns correctly', function (): void {
    $cfg = AiProviderConfig::query()->create([
        'code' => strtolower(Str::random(8)),
        'name' => 'OpenAI',
        'base_url' => 'https://api.openai.com',
        'auth_type' => 'bearer',
        'model' => 'gpt-4o',
        'temperature' => 0.25,
        'timeout_ms' => 30000,
        'retry_count' => 3,
        'is_fallback' => false,
        'priority' => 10,
        'active' => true,
    ]);

    expect($cfg->temperature)->toBe(0.25)
        ->and($cfg->timeout_ms)->toBe(30000)
        ->and($cfg->retry_count)->toBe(3)
        ->and($cfg->is_fallback)->toBeFalse()
        ->and($cfg->priority)->toBe(10)
        ->and($cfg->active)->toBeTrue()
        ->and($cfg->id)->toBeString()
        ->and(Str::isUuid($cfg->id))->toBeTrue();
});

it('PromptVersion casts expected_json_schema as array and exposes status constants', function (): void {
    $pv = PromptVersion::query()->create([
        'name' => 'test_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => 'classify',
        'provider_code' => 'openai',
        'prompt_text' => 'You classify civic reports.',
        'expected_json_schema' => ['type' => 'object', 'required' => ['label']],
        'status' => PromptVersion::STATUS_DRAFT,
    ]);

    expect($pv->expected_json_schema)->toBe(['type' => 'object', 'required' => ['label']])
        ->and($pv->status)->toBe('draft')
        ->and(PromptVersion::STATUS_DRAFT)->toBe('draft')
        ->and(PromptVersion::STATUS_APPROVED)->toBe('approved')
        ->and(PromptVersion::STATUS_DEPRECATED)->toBe('deprecated');
});

it('AiJob exposes status constants and belongs to a Report and a PromptVersion', function (): void {
    $report = Report::factory()->create();
    $pv = PromptVersion::query()->create([
        'name' => 'rel_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
    ]);

    $job = AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => AiJob::STATUS_QUEUED,
        'requested_at' => now(),
    ]);

    expect($job->status)->toBe('queued')
        ->and(AiJob::STATUS_QUEUED)->toBe('queued')
        ->and(AiJob::STATUS_RUNNING)->toBe('running')
        ->and(AiJob::STATUS_SUCCEEDED)->toBe('succeeded')
        ->and(AiJob::STATUS_FAILED)->toBe('failed')
        ->and(AiJob::STATUS_TIMEOUT)->toBe('timeout')
        ->and($job->report)->toBeInstanceOf(Report::class)
        ->and($job->report->id)->toBe($report->id)
        ->and($job->promptVersion)->toBeInstanceOf(PromptVersion::class)
        ->and($job->promptVersion->id)->toBe($pv->id);
});

it('AiJob has a 1:1 AiResult relationship', function (): void {
    $report = Report::factory()->create();
    $pv = PromptVersion::query()->create([
        'name' => 'oneone_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
    ]);

    $job = AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => AiJob::STATUS_SUCCEEDED,
        'requested_at' => now(),
        'started_at' => now(),
        'completed_at' => now(),
        'processing_time_ms' => 1000,
        'retry_count' => 0,
    ]);

    $result = AiResult::query()->create([
        'job_id' => $job->id,
        'predicted_type' => 'pothole',
        'confidence' => 0.9,
        'recommended_department' => 'public_works',
        'severity' => 'high',
        'quality_score' => 85,
        'duplicate_score' => 0,
        'fraud_score' => 2,
        'summary' => 'Pothole',
        'raw_response' => ['choices' => []],
        'created_at' => now(),
    ]);

    expect($job->result)->toBeInstanceOf(AiResult::class)
        ->and($job->result->id)->toBe($result->id)
        ->and($result->raw_response)->toBe(['choices' => []])
        ->and($result->confidence)->toBe(0.9);
});

it('AiResult casts raw_response as an array and timestamps off by default', function (): void {
    $report = Report::factory()->create();
    $pv = PromptVersion::query()->create([
        'name' => 'rawr_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => AiJob::STATUS_SUCCEEDED,
        'requested_at' => now(),
    ]);
    $result = AiResult::query()->create([
        'job_id' => $job->id,
        'predicted_type' => 'pothole',
        'confidence' => 0.5,
        'recommended_department' => 'public_works',
        'severity' => 'low',
        'quality_score' => 50,
        'duplicate_score' => 0,
        'fraud_score' => 0,
        'summary' => 'x',
        'raw_response' => ['k' => 'v'],
        'created_at' => now(),
    ]);

    expect($result->raw_response)->toBe(['k' => 'v'])
        ->and($result->updated_at)->toBeNull()
        ->and($result->created_at)->toBeInstanceOf(Carbon::class);
});

it('AiResult has many AiLabels and primaryLabel() returns the is_primary row', function (): void {
    $report = Report::factory()->create();
    $pv = PromptVersion::query()->create([
        'name' => 'labels_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => AiJob::STATUS_SUCCEEDED,
        'requested_at' => now(),
    ]);
    $result = AiResult::query()->create([
        'job_id' => $job->id,
        'predicted_type' => 'pothole',
        'confidence' => 0.8,
        'recommended_department' => 'public_works',
        'severity' => 'medium',
        'quality_score' => 80,
        'duplicate_score' => 0,
        'fraud_score' => 0,
        'summary' => 'x',
        'raw_response' => [],
        'created_at' => now(),
    ]);

    AiLabel::query()->create([
        'result_id' => $result->id,
        'label' => 'pothole',
        'confidence' => 0.9,
        'is_primary' => true,
        'created_at' => now(),
    ]);
    AiLabel::query()->create([
        'result_id' => $result->id,
        'label' => 'road_damage',
        'confidence' => 0.5,
        'is_primary' => false,
        'created_at' => now(),
    ]);

    expect($result->labels)->toHaveCount(2)
        ->and($result->primaryLabel())->toBeInstanceOf(AiLabel::class)
        ->and($result->primaryLabel()->label)->toBe('pothole')
        ->and($result->primaryLabel()->is_primary)->toBeTrue();
});

it('AiLabel belongs to AiResult and casts is_primary to bool', function (): void {
    $report = Report::factory()->create();
    $pv = PromptVersion::query()->create([
        'name' => 'labrel_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
    ]);
    $job = AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $pv->id,
        'provider_code' => 'openai',
        'model' => 'gpt-4o',
        'status' => AiJob::STATUS_SUCCEEDED,
        'requested_at' => now(),
    ]);
    $result = AiResult::query()->create([
        'job_id' => $job->id,
        'predicted_type' => 'pothole',
        'confidence' => 0.5,
        'recommended_department' => 'public_works',
        'severity' => 'low',
        'quality_score' => 50,
        'duplicate_score' => 0,
        'fraud_score' => 0,
        'summary' => 'x',
        'raw_response' => [],
        'created_at' => now(),
    ]);
    $label = AiLabel::query()->create([
        'result_id' => $result->id,
        'label' => 'pothole',
        'confidence' => 0.5,
        'is_primary' => 1,
        'created_at' => now(),
    ]);

    expect($label->is_primary)->toBeTrue()
        ->and($label->result)->toBeInstanceOf(AiResult::class)
        ->and($label->result->id)->toBe($result->id);
});

it('PromptVersion::approver() returns the User who approved the prompt', function (): void {
    $approver = User::factory()->create();

    $pv = PromptVersion::query()->create([
        'name' => 'appr_'.strtolower(Str::random(6)),
        'version' => 1,
        'purpose' => null,
        'provider_code' => 'openai',
        'prompt_text' => 'x',
        'expected_json_schema' => null,
        'status' => 'approved',
        'approved_by' => $approver->id,
        'approved_at' => now(),
    ]);

    expect($pv->approver)->toBeInstanceOf(User::class)
        ->and($pv->approver->id)->toBe($approver->id);
});
