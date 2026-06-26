<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Exceptions\InvalidTransitionException;
use App\Modules\Workflow\Exceptions\UnauthorizedTransitionException;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Services\ConditionEvaluator;
use App\Modules\Workflow\Services\TransitionGuard;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->guard = new TransitionGuard(new ConditionEvaluator);
    $this->report = Report::factory()->make(['citizen_id' => null, 'fraud_score' => 0.2]);
    $this->actor = User::factory()->create();
    $this->def = WorkflowDefinition::factory()->create();
    $this->from = WorkflowState::factory()->create(['workflow_definition_id' => $this->def->id]);
    $this->to = WorkflowState::factory()->create(['workflow_definition_id' => $this->def->id]);
});

it('passes when the transition has no role / permission / condition gates', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'required_role' => null,
        'required_permission' => null,
        'conditions' => null,
    ]);
    $this->guard->ensure($t, $this->actor, $this->report);
    expect(true)->toBeTrue();
});

it('passes when the actor has the required role', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'required_role' => 'moderator',
    ]);
    Role::firstOrCreate(['name' => 'moderator', 'guard_name' => 'web']);
    $this->actor->assignRole('moderator');
    $this->guard->ensure($t, $this->actor, $this->report);
    expect(true)->toBeTrue();
});

it('throws UnauthorizedTransitionException when the required role is missing', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'required_role' => 'moderator',
    ]);
    $this->guard->ensure($t, $this->actor, $this->report);
})->throws(UnauthorizedTransitionException::class, "requires the 'moderator' role");

it('throws UnauthorizedTransitionException when the required permission is missing', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'required_permission' => 'reports.review',
    ]);
    $this->guard->ensure($t, $this->actor, $this->report);
})->throws(UnauthorizedTransitionException::class, "requires the 'reports.review' permission");

it('passes when the conditions DSL matches the (report, actor) context', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'conditions' => ['fraud_score' => ['lte' => 0.5]],
    ]);
    $this->guard->ensure($t, $this->actor, $this->report);
    expect(true)->toBeTrue();
});

it('throws InvalidTransitionException when the conditions do NOT match', function (): void {
    $t = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $this->def->id,
        'from_state_id' => $this->from->id,
        'to_state_id' => $this->to->id,
        'event' => 'submit',
        'conditions' => ['fraud_score' => ['lte' => 0.0]],
    ]);
    $this->guard->ensure($t, $this->actor, $this->report);
})->throws(InvalidTransitionException::class);
