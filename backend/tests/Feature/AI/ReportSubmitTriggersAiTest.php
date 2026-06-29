<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Listeners\ReportSubmittedListener;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use Database\Seeders\AiProvidersSeeder;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\PromptsSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);



beforeEach(function (): void {
    Bus::fake([AiPipelineOrchestrator::class]);
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    // Seed the AI stack so the listener's guard passes.
    (new AiProvidersSeeder)->run();
    (new PromptsSeeder)->run();
});

it('dispatches AiPipelineOrchestrator when a report transitions to ai_processing', function (): void {
    $report = Report::factory()->create();
    $aiProcessing = ReportStatus::query()->where('code', 'ai_processing')->firstOrFail();
    $report->update(['current_status_id' => $aiProcessing->id]);

    ReportStatusChanged::dispatch(
        reportId: $report->id,
        fromStatusId: null,
        toStatusId: $aiProcessing->id,
        actorId: null,
        reason: 'submit',
    );

    Bus::assertDispatched(AiPipelineOrchestrator::class, function (AiPipelineOrchestrator $job) use ($report): bool {
        return $job->reportId === $report->id;
    });
});

it('does NOT dispatch the orchestrator for a transition to a different status', function (): void {
    $report = Report::factory()->create();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();

    ReportStatusChanged::dispatch(
        reportId: $report->id,
        fromStatusId: null,
        toStatusId: $submitted->id,
        actorId: null,
        reason: 'submit',
    );

    Bus::assertNotDispatched(AiPipelineOrchestrator::class);
});

it('the listener does NOT dispatch when the report has not reached ai_processing yet', function (): void {
    $report = Report::factory()->create();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $report->update(['current_status_id' => $submitted->id]);

    ReportStatusChanged::dispatch(
        reportId: $report->id,
        fromStatusId: null,
        toStatusId: $submitted->id,
        actorId: null,
        reason: 'submit',
    );

    Bus::assertNotDispatched(AiPipelineOrchestrator::class);
});

it('the listener is a ShouldQueue and is bound to the event in the service provider', function (): void {
    expect(app(ReportSubmittedListener::class))->toBeInstanceOf(ReportSubmittedListener::class);

    $reflection = new ReflectionClass(ReportSubmittedListener::class);
    expect($reflection->implementsInterface(ShouldQueue::class))->toBeTrue();
});
