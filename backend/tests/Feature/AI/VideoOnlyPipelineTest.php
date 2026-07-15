<?php

declare(strict_types=1);

use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\Services\AiMediaReferenceResolver;
use App\Modules\AI\Services\AiResponseValidator;
use App\Modules\AI\Services\DuplicateDetector;
use App\Modules\AI\Services\FraudScorer;
use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\AI\Services\PiiMaskingService;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Services\FeatureFlagService;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

it('routes video-only evidence to manual review without calling the image provider', function (): void {
    Event::fake([AiCompleted::class]);
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();

    $prompt = PromptVersion::query()->create([
        'id' => (string) Str::uuid(),
        'name' => 'category_classifier',
        'version' => 1,
        'provider_code' => 'mock',
        'prompt_text' => 'x',
        'status' => PromptVersion::STATUS_APPROVED,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $report = Report::factory()->create();
    Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'VIDEO',
        'mime' => 'video/mp4',
        'storage_path' => 'reports/evidence.mp4',
        'duration' => 10,
        'width' => 1280,
        'height' => 720,
    ]);

    /** @var ProviderFailoverService&MockInterface $failover */
    $failover = Mockery::mock(ProviderFailoverService::class);
    $failover->shouldNotReceive('execute');
    /** @var AiMediaReferenceResolver&MockInterface $mediaReferences */
    $mediaReferences = Mockery::mock(AiMediaReferenceResolver::class);
    $mediaReferences->shouldNotReceive('resolve');
    (new AiPipelineOrchestrator($report->id))->handle(
        $failover,
        app(AiResponseValidator::class),
        app(ImageQualityAnalyzer::class),
        app(DuplicateDetector::class),
        app(FraudScorer::class),
        app(PiiMaskingService::class),
        app(FeatureFlagService::class),
        $mediaReferences,
    );

    $job = AiJob::query()->where('report_id', $report->id)->firstOrFail();
    $result = AiResult::query()->where('job_id', $job->id)->firstOrFail();

    expect($job->prompt_version_id)->toBe($prompt->id)
        ->and($job->status)->toBe(AiJob::STATUS_SUCCEEDED)
        ->and($job->provider_code)->toBe('video-review')
        ->and($result->predicted_type)->toBe('unclassified')
        ->and($result->confidence)->toBe(0.0)
        ->and($result->raw_response)->toMatchArray(['video_review' => true]);
});
