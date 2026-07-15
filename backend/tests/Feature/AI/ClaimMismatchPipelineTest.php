<?php

declare(strict_types=1);

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Events\AiCompleted;
use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Models\AiResult;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\Services\AiMediaReferenceResolver;
use App\Modules\AI\Services\AiResponseValidator;
use App\Modules\AI\Services\DuplicateDetector;
use App\Modules\AI\Services\FraudScorer;
use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\AI\Services\PiiMaskingService;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Settings\Services\FeatureFlagService;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('suppresses provider labels and confidence when evidence does not match the claim', function (): void {
    Event::fake([AiCompleted::class]);
    Storage::fake('local');
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();

    AppConfig::factory()->enabled()->create(['key' => 'ai_enabled']);
    PromptVersion::query()->create([
        'id' => (string) Str::uuid(),
        'name' => 'category_classifier',
        'version' => 1,
        'provider_code' => 'hallucinating',
        'prompt_text' => 'x',
        'status' => PromptVersion::STATUS_APPROVED,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    AiProviderConfig::query()->create([
        'code' => 'hallucinating',
        'driver' => 'custom',
        'name' => 'Hallucinating provider',
        'base_url' => 'http://localhost',
        'auth_type' => 'none',
        'model' => 'bad-fit-vlm',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 1,
        'is_fallback' => false,
        'priority' => 10,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $report = Report::factory()->create([
        'title' => 'Dead animal on road',
        'description' => 'Animal carcass blocking traffic',
    ]);
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'mime' => 'image/jpeg',
        'storage_path' => 'reports/selfie.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, 'fake image bytes');

    $provider = new class implements AIProviderInterface
    {
        public function getName(): string
        {
            return 'hallucinating';
        }

        public function getModel(): string
        {
            return 'bad-fit-vlm';
        }

        public function healthCheck(): bool
        {
            return true;
        }

        public function classify(AiRequest $request): AiResponse
        {
            return new AiResponse(
                labels: [[
                    'label' => 'pothole',
                    'confidence' => 0.60,
                    'is_primary' => true,
                ]],
                predictedType: 'pothole',
                confidence: 0.60,
                recommendedDepartment: '',
                severity: 'low',
                qualityScore: 60,
                duplicateScore: 0,
                fraudScore: 40,
                summary: 'A person is seen indoors.',
                raw: ['provider_response' => true],
                claimMatchesEvidence: false,
                consistencyScore: 0,
                mismatchReason: 'The image shows a person indoors, not a dead animal.',
                syntheticScore: 0.0,
            );
        }
    };

    (new AiPipelineOrchestrator($report->id))->handle(
        new ProviderFailoverService(['hallucinating' => $provider]),
        app(AiResponseValidator::class),
        app(ImageQualityAnalyzer::class),
        app(DuplicateDetector::class),
        app(FraudScorer::class),
        app(PiiMaskingService::class),
        app(FeatureFlagService::class),
        app(AiMediaReferenceResolver::class),
    );

    $job = AiJob::query()->where('report_id', $report->id)->firstOrFail();
    $result = AiResult::query()->where('job_id', $job->id)->firstOrFail();
    $label = $result->labels()->firstOrFail();
    $report->refresh();

    expect($result->predicted_type)->toBe('unclassified')
        ->and($result->confidence)->toBe(0.0)
        ->and($result->claim_matches_evidence)->toBeFalse()
        ->and($result->consistency_score)->toBe(0)
        ->and($result->raw_response)->toMatchArray(['claim_mismatch_gate' => true])
        ->and($label->label)->toBe('unclassified')
        ->and($label->confidence)->toBe(0.0)
        ->and($report->ai_confidence)->toBe(0.0);
});
