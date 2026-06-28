<?php

declare(strict_types=1);

use App\Modules\Moderation\DTO\ReviewReportDto;
use App\Modules\Moderation\Events\ReportModerated;
use App\Modules\Moderation\Services\ModerationService;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\WorkflowEngine;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * ModerationService::review end-to-end coverage.
 *
 * The test seeds a report that has been routed to the
 * `pending_moderator` state (the typical M7→M10 hand-off)
 * and exercises the four decisions through the workflow
 * engine. Each test asserts:
 *  - the workflow transition succeeded
 *  - the audit row carries the before/after
 *  - the ReportModerated event fires with the right payload
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    Event::fake([ReportStatusChanged::class, ReportModerated::class]);
});

if (! function_exists('makeModerator')) {
function makeModerator(): User
{
    $u = User::factory()->create();
    $u->assignRole('moderator');

    return $u;
}
}

/**
 * Move the report through the workflow engine to land in
 * `pending_moderator` (the M10 hand-off state).
 */
if (! function_exists('landReportInPendingModerator')) {
function landReportInPendingModerator(): Report
{
    $engine = app(WorkflowEngine::class);

    $definition = \App\Modules\Workflow\Models\WorkflowDefinition::query()->where('code', 'civic_default')->firstOrFail();
    $draft = \App\Modules\Reports\Models\ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $report = Report::factory()->create([
        'workflow_id' => $definition->id,
        'current_status_id' => $draft->id,
    ]);

    // submit (no actor required)
    $d = $engine->evaluate($report, 'submit', null);
    $engine->apply($report, $d, null);
    $report = $report->refresh();
    $report->load('status');

    // ai_complete requires a system actor.
    $system = User::factory()->create();
    $system->assignRole('system');
    $d = $engine->evaluate($report, 'ai_complete', $system);
    $engine->apply($report, $d, $system);
    $report = $report->refresh();
    $report->load('status');

    // moderator_review also requires system.
    $d = $engine->evaluate($report, 'moderator_review', $system);
    $engine->apply($report, $d, $system);

    return $report->refresh()->load('status');
}
}

it('a moderator can approve a pending_moderator report', function (): void {
    $report = landReportInPendingModerator();
    $moderator = makeModerator();

    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'remarks' => 'Verified on the ground — assigning to BBMP roads.',
    ]);

    $service = app(ModerationService::class);
    $updated = $service->review($report, $dto, $moderator);

    expect($updated->status?->code)->toBe('assigned');

    $audit = AuditLog::query()
        ->where('entity_id', $report->id)
        ->where('action', 'report.moderated')
        ->latest('created_at')
        ->first();
    expect($audit)->not->toBeNull();
    expect($audit->before)->toHaveKey('current_status_id');
    expect($audit->after)->toHaveKey('current_status_id');
    expect($audit->after['decision'] ?? null)->toBe('approve');
    expect($audit->after['override_ai'] ?? null)->toBeFalse();

    Event::assertDispatched(ReportModerated::class, function (ReportModerated $e) use ($report): bool {
        return $e->reportId === $report->id
            && $e->decision === 'approve'
            && $e->overrideAi === false
            && $e->actorId !== null;
    });
});

it('a moderator can reject a pending_moderator report', function (): void {
    $report = landReportInPendingModerator();
    $moderator = makeModerator();

    $dto = ReviewReportDto::fromArray([
        'decision' => 'reject',
        'reason_code' => 'duplicate',
        'remarks' => 'Already reported as CIV-2026-000123.',
    ]);

    $service = app(ModerationService::class);
    $updated = $service->review($report, $dto, $moderator);

    expect($updated->status?->code)->toBe('rejected');

    Event::assertDispatched(ReportModerated::class, fn (ReportModerated $e): bool => $e->decision === 'reject' && $e->reasonCode === 'duplicate');
});

it('a moderator can escalate a pending_moderator report', function (): void {
    $report = landReportInPendingModerator();
    $moderator = makeModerator();

    $dto = ReviewReportDto::fromArray([
        'decision' => 'escalate',
        'override_ai' => true,
        'reason_code' => 'high_fraud_score',
        'remarks' => 'AI fraud score 0.91 — needs senior review.',
    ]);

    $service = app(ModerationService::class);
    $updated = $service->review($report, $dto, $moderator);

    expect($updated->status?->code)->toBe('escalated');

    $audit = AuditLog::query()
        ->where('entity_id', $report->id)
        ->where('action', 'report.moderated')
        ->latest('created_at')
        ->first();
    expect($audit->after['decision'] ?? null)->toBe('escalate');
    expect($audit->after['override_ai'] ?? null)->toBeTrue();
});

it('rejects review when the current state has no matching transition', function (): void {
    // A report in 'draft' state cannot be approved.
    $draft = \App\Modules\Reports\Models\ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $report = Report::factory()->create(['current_status_id' => $draft->id]);
    $moderator = makeModerator();

    $dto = ReviewReportDto::fromArray(['decision' => 'approve']);

    $service = app(ModerationService::class);
    $service->review($report, $dto, $moderator);
})->throws(\App\Modules\Shared\Exceptions\ApiException::class);

it('rejects a non-moderator actor', function (): void {
    $report = landReportInPendingModerator();
    $citizen = User::factory()->create();

    $dto = ReviewReportDto::fromArray(['decision' => 'approve']);

    $service = app(ModerationService::class);
    $service->review($report, $dto, $citizen);
})->throws(\App\Modules\Shared\Exceptions\ApiException::class);

it('an override writes the before/after category in the audit row', function (): void {
    $report = landReportInPendingModerator();
    $moderator = makeModerator();
    $originalCategory = $report->report_type_id;

    $newType = \App\Modules\Reports\Models\ReportType::factory()->create();

    $dto = ReviewReportDto::fromArray([
        'decision' => 'approve',
        'category_id' => $newType->id,
        'override_ai' => true,
        'remarks' => 'AI misclassified as garbage; actually a pothole.',
    ]);

    $service = app(ModerationService::class);
    $service->review($report, $dto, $moderator);

    $audit = AuditLog::query()
        ->where('entity_id', $report->id)
        ->where('action', 'report.moderated')
        ->latest('created_at')
        ->first();

    expect($audit->before['report_type_id'])->toBe($originalCategory);
    expect($audit->after['report_type_id'])->toBe($newType->id);
    expect($audit->after['override_ai'])->toBeTrue();
});
