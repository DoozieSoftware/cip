<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;

beforeEach(function (): void {
    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));

    $this->def = WorkflowDefinition::factory()->create();
    $this->draft = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'draft', 'name' => 'Draft', 'is_initial' => true,
    ]);
    $this->submitted = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'submitted', 'name' => 'Submitted',
    ]);

    foreach (['draft', 'submitted'] as $code) {
        ReportStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => ucfirst($code), 'is_terminal' => false, 'sort_order' => 0, 'active' => true],
        );
    }
    $draftStatus = ReportStatus::query()->where('code', 'draft')->first();

    $this->report = Report::factory()->create([
        'workflow_id' => $this->def->id,
        'current_status_id' => $draftStatus->id,
        'citizen_id' => null,
    ]);

    $this->trans = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'required_role' => null,
        'required_permission' => null,
    ]);
});

it('apply writes an audit_logs row with entity=reports', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);
    expect($decision->allowed)->toBeTrue();

    $this->engine->apply($this->report, $decision, null);

    $audit = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->first();

    expect($audit)->not->toBeNull();
});

it('apply audit row carries the before/after current_status_id pair', function (): void {
    $draftStatusId = (string) ReportStatus::query()->where('code', 'draft')->value('id');
    $submittedStatusId = (string) ReportStatus::query()->where('code', 'submitted')->value('id');

    $decision = $this->engine->evaluate($this->report, 'submit', null);
    $this->engine->apply($this->report, $decision, null);

    $audit = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->firstOrFail();

    expect($audit->before['current_status_id'])->toBe($draftStatusId)
        ->and($audit->after['current_status_id'])->toBe($submittedStatusId);
});

it('apply audit row carries the workflow_id on both before and after', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);
    $this->engine->apply($this->report, $decision, null);

    $audit = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->firstOrFail();

    expect($audit->before['workflow_id'])->toBe($this->def->id)
        ->and($audit->after['workflow_id'])->toBe($this->def->id);
});

it('apply audit row records the actor user_id when supplied', function (): void {
    $actor = User::factory()->create();

    $decision = $this->engine->evaluate($this->report, 'submit', $actor);
    expect($decision->allowed)->toBeTrue();

    $this->engine->apply($this->report, $decision, $actor);

    $audit = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->firstOrFail();

    expect($audit->user_id)->toBe($actor->id);
});

it('apply audit row records null user_id when actor is null', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);
    $this->engine->apply($this->report, $decision, null);

    $audit = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->firstOrFail();

    expect($audit->user_id)->toBeNull();
});

it('apply writes exactly one audit row per transition (no double-write)', function (): void {
    $decision = $this->engine->evaluate($this->report, 'submit', null);
    $this->engine->apply($this->report, $decision, null);

    $count = AuditLog::query()
        ->where('entity', 'reports')
        ->where('entity_id', $this->report->id)
        ->where('action', 'workflow.transition')
        ->count();

    expect($count)->toBe(1);
});
