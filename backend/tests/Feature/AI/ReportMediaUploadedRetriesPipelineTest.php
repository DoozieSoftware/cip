<?php

declare(strict_types=1);

use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Media\Events\ReportMediaUploaded;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use Database\Seeders\AiProvidersSeeder;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\PromptsSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Bus::fake([AiPipelineOrchestrator::class]);
    Storage::fake('local');
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    (new AiProvidersSeeder)->run();
    (new PromptsSeeder)->run();
});

it('dispatches the AI pipeline when a photo is uploaded to an ai_processing report', function (): void {
    $report = Report::factory()->create();
    $aiProcessing = ReportStatus::query()->where('code', 'ai_processing')->firstOrFail();
    $report->update(['current_status_id' => $aiProcessing->id]);

    $file = UploadedFile::fake()->image('pothole.jpg', 120, 120);

    app(MediaService::class)->uploadPhoto($report->id, $file, (string) $report->citizen_id);

    Bus::assertDispatched(AiPipelineOrchestrator::class, function (AiPipelineOrchestrator $job) use ($report): bool {
        return $job->reportId === $report->id;
    });
});

it('does NOT re-arm the pipeline when media is uploaded to a non-ai_processing report', function (): void {
    $report = Report::factory()->create();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $report->update(['current_status_id' => $submitted->id]);

    $file = UploadedFile::fake()->image('pothole.jpg', 120, 120);

    app(MediaService::class)->uploadPhoto($report->id, $file, (string) $report->citizen_id);

    Bus::assertNotDispatched(AiPipelineOrchestrator::class);
});

it('does NOT re-arm an already-succeeded pipeline on a later upload', function (): void {
    $report = Report::factory()->create();
    $aiProcessing = ReportStatus::query()->where('code', 'ai_processing')->firstOrFail();
    $report->update(['current_status_id' => $aiProcessing->id]);

    // Simulate a completed run so the listener should stand down.
    $promptVersion = PromptVersion::query()
        ->where('status', 'approved')
        ->firstOrFail();
    AiJob::query()->create([
        'report_id' => $report->id,
        'prompt_version_id' => $promptVersion->id,
        'provider_code' => 'mock',
        'model' => 'mock-1.0',
        'status' => AiJob::STATUS_SUCCEEDED,
        'requested_at' => now(),
        'started_at' => now(),
        'completed_at' => now(),
        'retry_count' => 0,
    ]);

    $file = UploadedFile::fake()->image('pothole.jpg', 120, 120);

    app(MediaService::class)->uploadPhoto($report->id, $file, (string) $report->citizen_id);

    Bus::assertNotDispatched(AiPipelineOrchestrator::class);
});

it('fires ReportMediaUploaded on photo upload', function (): void {
    Event::fake([ReportMediaUploaded::class]);

    $report = Report::factory()->create();
    $file = UploadedFile::fake()->image('pothole.jpg', 120, 120);

    app(MediaService::class)->uploadPhoto($report->id, $file, (string) $report->citizen_id);

    Event::assertDispatched(ReportMediaUploaded::class, function (ReportMediaUploaded $e) use ($report): bool {
        return $e->reportId === $report->id && $e->mediaType === 'PHOTO';
    });
});
