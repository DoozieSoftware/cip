<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use App\Modules\Workflow\Services\WorkflowEngine;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->engine = new WorkflowEngine(new TransitionGuard(new ConditionEvaluator));

    // Build a small 3-state workflow:
    //   draft --submit--> submitted --approve--> approved
    $this->def = WorkflowDefinition::factory()->create();
    $this->draft = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'draft', 'name' => 'Draft', 'is_initial' => true,
    ]);
    $this->submitted = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'submitted', 'name' => 'Submitted',
    ]);
    $this->approved = WorkflowState::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'code' => 'approved', 'name' => 'Approved', 'is_terminal' => true,
    ]);

    // Seed the M4 status rows so the engine can bridge.
    foreach (['draft', 'submitted', 'approved'] as $code) {
        ReportStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => ucfirst($code), 'is_terminal' => $code === 'approved', 'sort_order' => 0, 'active' => true],
        );
    }

    $this->report = Report::factory()->make([
        'workflow_id' => $this->def->id,
        'current_status_id' => ReportStatus::query()->where('code', 'draft')->first()->id,
        'citizen_id' => null,
    ]);

    $this->moderator = User::factory()->create();
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    $this->moderator->assignRole('moderator');
});

it('returns a positive decision for the highest-priority matching transition', function (): void {
    $lowPriority = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->approved->id,
        'event' => 'submit',
        'priority' => 0,
    ]);
    $highPriority = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'priority' => 10,
    ]);

    $d = $this->engine->evaluate($this->report, 'submit', $this->moderator);

    expect($d->allowed)->toBeTrue();
    expect($d->toStateId)->toBe($this->submitted->id);
    expect($d->matchedTransitionId)->toBe($highPriority->id);
});

it('denies when no transition exists for (state, event)', function (): void {
    $d = $this->engine->evaluate($this->report, 'submit', $this->moderator);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain("No transition for event 'submit' from state 'draft'");
});

it('denies when the only matching transition requires a role the actor lacks', function (): void {
    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'required_role' => 'moderator',
    ]);

    $actor = User::factory()->create(); // no role
    $d = $this->engine->evaluate($this->report, 'submit', $actor);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain("requires the 'moderator' role");
});

it('denies when the transition\'s conditions fail (actor passed the role check)', function (): void {
    $this->report->fraud_score = 0.9;
    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'required_role' => 'moderator',
        'conditions' => ['fraud_score' => ['lte' => 0.3]],
    ]);
    $d = $this->engine->evaluate($this->report, 'submit', $this->moderator);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain('conditions');
});

it('falls back to the next-priority transition when the highest fails the guard', function (): void {
    $blocked = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->approved->id,
        'event' => 'submit',
        'priority' => 100,
        'required_role' => 'super_admin',
    ]);
    $fallback = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->draft->id,
        'to_state_id' => $this->submitted->id,
        'event' => 'submit',
        'priority' => 10,
    ]);

    $d = $this->engine->evaluate($this->report, 'submit', $this->moderator);
    expect($d->allowed)->toBeTrue();
    expect($d->matchedTransitionId)->toBe($fallback->id);
});

it('returns a deny with reasons when called with an empty event name', function (): void {
    $d = $this->engine->evaluate($this->report, '', $this->moderator);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain('event is required');
});

it('denies when the report has no workflow definition', function (): void {
    $orphan = Report::factory()->make(['workflow_id' => null]);
    $d = $this->engine->evaluate($orphan, 'submit', $this->moderator);
    expect($d->allowed)->toBeFalse();
    expect($d->reasons[0])->toContain('no workflow definition');
});
