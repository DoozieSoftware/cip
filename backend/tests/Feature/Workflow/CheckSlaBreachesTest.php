<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportStatusHistory;
use App\Modules\Workflow\Events\SlaBreached;
use App\Modules\Workflow\Jobs\CheckSlaBreaches;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Seed the report_statuses that the job needs.
    foreach (['draft', 'submitted', 'pending_moderator', 'resolved', 'closed', 'rejected'] as $code) {
        ReportStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => ucfirst($code), 'is_terminal' => false, 'sort_order' => 0, 'active' => true],
        );
    }

    $this->def = WorkflowDefinition::factory()->create();
    $this->pendingState = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'pending_moderator',
        'name' => 'Pending Moderator',
    ]);
    $this->assignedState = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'assigned',
        'name' => 'Assigned',
    ]);
});

it('emits SlaBreached for a report whose transition SLA has passed', function (): void {
    $pendingId = (string) ReportStatus::query()->where('code', 'pending_moderator')->value('id');

    $report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $pendingId,
    ]);

    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->pendingState->id,
        'to_state_id' => $this->assignedState->id,
        'event' => 'assign',
        'sla_minutes' => 60,
        'active' => true,
    ]);

    // The report entered pending_moderator 2 hours ago.
    ReportStatusHistory::query()->create([
        'report_id' => $report->id,
        'from_status_id' => null,
        'to_status_id' => $pendingId,
        'actor_id' => null,
        'reason' => 'seed',
        'metadata' => null,
        'created_at' => Carbon::now()->subHours(2),
    ]);

    Event::fake([SlaBreached::class]);

    (new CheckSlaBreaches)->handle();

    Event::assertDispatched(SlaBreached::class, function (SlaBreached $e) use ($report): bool {
        return $e->reportId === $report->id
            && $e->currentStateCode === 'pending_moderator'
            && $e->elapsedMinutes >= 120
            && count($e->overdueTransitions) === 1
            && $e->overdueTransitions[0]['event'] === 'assign';
    });
});

it('does not emit SlaBreached for a report that is within SLA', function (): void {
    $pendingId = (string) ReportStatus::query()->where('code', 'pending_moderator')->value('id');

    $report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $pendingId,
    ]);

    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->pendingState->id,
        'to_state_id' => $this->assignedState->id,
        'event' => 'assign',
        'sla_minutes' => 120,
        'active' => true,
    ]);

    ReportStatusHistory::query()->create([
        'report_id' => $report->id,
        'from_status_id' => null,
        'to_status_id' => $pendingId,
        'actor_id' => null,
        'reason' => 'seed',
        'metadata' => null,
        'created_at' => Carbon::now()->subMinutes(30),
    ]);

    Event::fake([SlaBreached::class]);

    (new CheckSlaBreaches)->handle();

    Event::assertNotDispatched(SlaBreached::class);
});

it('skips reports whose current status has no matching workflow state', function (): void {
    $resolvedId = (string) ReportStatus::query()->where('code', 'resolved')->value('id');

    // Report anchored to this def but currently in a state
    // that does not exist on this def (so the join is empty).
    $report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $resolvedId,
    ]);

    Event::fake([SlaBreached::class]);

    (new CheckSlaBreaches)->handle();

    Event::assertNotDispatched(SlaBreached::class);
});

it('skips reports that have no workflow_id at all', function (): void {
    $submittedId = (string) ReportStatus::query()->where('code', 'submitted')->value('id');

    Report::factory()->create([
        'workflow_id' => null,
        'current_status_id' => $submittedId,
    ]);

    Event::fake([SlaBreached::class]);

    (new CheckSlaBreaches)->handle();

    Event::assertNotDispatched(SlaBreached::class);
});

it('lists every overdue transition in the SlaBreached event', function (): void {
    $pendingId = (string) ReportStatus::query()->where('code', 'pending_moderator')->value('id');

    $report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $pendingId,
    ]);

    $rejectedState = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'rejected',
        'name' => 'Rejected',
    ]);

    // Two outgoing transitions, both overdue.
    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->pendingState->id,
        'to_state_id' => $this->assignedState->id,
        'event' => 'assign',
        'sla_minutes' => 60,
        'active' => true,
    ]);
    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->pendingState->id,
        'to_state_id' => $rejectedState->id,
        'event' => 'reject',
        'sla_minutes' => 30,
        'active' => true,
    ]);

    ReportStatusHistory::query()->create([
        'report_id' => $report->id,
        'from_status_id' => null,
        'to_status_id' => $pendingId,
        'actor_id' => null,
        'reason' => 'seed',
        'metadata' => null,
        'created_at' => Carbon::now()->subHours(3),
    ]);

    Event::fake([SlaBreached::class]);

    (new CheckSlaBreaches)->handle();

    Event::assertDispatched(SlaBreached::class, function (SlaBreached $e) use ($report): bool {
        return $e->reportId === $report->id && count($e->overdueTransitions) === 2;
    });
});

it('dry-run mode does not dispatch the event but still returns a positive count', function (): void {
    $pendingId = (string) ReportStatus::query()->where('code', 'pending_moderator')->value('id');

    $report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $pendingId,
    ]);

    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->pendingState->id,
        'to_state_id' => $this->assignedState->id,
        'event' => 'assign',
        'sla_minutes' => 60,
        'active' => true,
    ]);

    ReportStatusHistory::query()->create([
        'report_id' => $report->id,
        'from_status_id' => null,
        'to_status_id' => $pendingId,
        'actor_id' => null,
        'reason' => 'seed',
        'metadata' => null,
        'created_at' => Carbon::now()->subHours(2),
    ]);

    Event::fake([SlaBreached::class]);

    $count = (new CheckSlaBreaches(dryRun: true))->handle();

    expect($count)->toBeGreaterThan(0);
    Event::assertNotDispatched(SlaBreached::class);
});
