<?php

declare(strict_types=1);

use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;

it('round-trips a WorkflowDefinition through Eloquent', function (): void {
    $def = WorkflowDefinition::factory()->create();
    expect($def)->toBeInstanceOf(WorkflowDefinition::class);
    expect($def->id)->toBeString()->not->toBe('');
    expect($def->active)->toBeTrue();
    expect($def->code)->toStartWith('wf_');
});

it('exposes the WorkflowDefinition -> states() and -> transitions() relations as collections', function (): void {
    $def = WorkflowDefinition::factory()
        ->has(WorkflowState::factory()->count(3), 'states')
        ->has(WorkflowTransition::factory()->count(2), 'transitions')
        ->create();

    expect($def->states)->toHaveCount(3);
    expect($def->states->first())->toBeInstanceOf(WorkflowState::class);
    expect($def->transitions)->toHaveCount(2);
    expect($def->transitions->first())->toBeInstanceOf(WorkflowTransition::class);
});

it('casts booleans and JSON columns correctly on the three models', function (): void {
    $def = WorkflowDefinition::factory()->inactive()->create();
    expect($def->active)->toBeFalse();

    $trans = WorkflowTransition::factory()->create([
        'conditions' => ['fraud_score' => ['lte' => 0.3]],
    ]);
    $trans->refresh();
    expect($trans->conditions)->toBe(['fraud_score' => ['lte' => 0.3]]);
    expect($trans->priority)->toBeInt();
    expect($trans->active)->toBeBool();
});

it('exposes definition / fromState / toState belongs-to relations on a transition', function (): void {
    $def = WorkflowDefinition::factory()->create();
    $from = WorkflowState::factory()->create(['workflow_definition_id' => $def->id]);
    $to = WorkflowState::factory()->create(['workflow_definition_id' => $def->id]);
    $trans = WorkflowTransition::factory()->create([
        'workflow_definition_id' => $def->id,
        'from_state_id' => $from->id,
        'to_state_id' => $to->id,
    ]);

    expect($trans->definition->id)->toBe($def->id);
    expect($trans->fromState->id)->toBe($from->id);
    expect($trans->toState->id)->toBe($to->id);
});

it('soft-deletes a WorkflowDefinition and excludes it from default queries', function (): void {
    $def = WorkflowDefinition::factory()->create();
    $def->delete();
    expect(WorkflowDefinition::query()->find($def->id))->toBeNull();
    expect(WorkflowDefinition::withTrashed()->find($def->id))->not->toBeNull();
});
