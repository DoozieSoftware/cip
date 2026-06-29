<?php

declare(strict_types=1);

use App\Modules\Workflow\Models\WorkflowDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);


beforeEach(function (): void {
    Cache::flush();
    $this->repo = new WorkflowRepository;
});

it('caches the active definition by code on the first call', function (): void {
    $def = WorkflowDefinition::factory()->create(['code' => 'civic_default', 'active' => true]);
    WorkflowState::factory()->count(2)->create(['workflow_definition_id' => $def->id]);
    WorkflowTransition::factory()->count(3)->create(['workflow_definition_id' => $def->id]);

    $first = $this->repo->findActiveByCode('civic_default');
    expect($first)->not->toBeNull();
    expect($first->id)->toBe($def->id);
    expect($first->relationLoaded('states'))->toBeTrue();
    expect($first->relationLoaded('transitions'))->toBeTrue();

    // Second call must hit the cache.
    Cache::shouldReceive('remember')
        ->once()
        ->with('workflow:def:code:civic_default', 3600, Closure::class)
        ->andReturn($first);
    Cache::shouldReceive('remember')
        ->never();
    $second = $this->repo->findActiveByCode('civic_default');
    expect($second->id)->toBe($def->id);
});

it('returns null when no active definition exists for the code', function (): void {
    expect($this->repo->findActiveByCode('does_not_exist'))->toBeNull();
});

it('excludes soft-deleted and inactive definitions from findActiveByCode', function (): void {
    $soft = WorkflowDefinition::factory()->create(['code' => 'soft', 'active' => true]);
    $soft->delete();
    $inactive = WorkflowDefinition::factory()->inactive()->create(['code' => 'inactive']);
    $live = WorkflowDefinition::factory()->create(['code' => 'live', 'active' => true]);

    expect($this->repo->findActiveByCode('soft'))->toBeNull();
    expect($this->repo->findActiveByCode('inactive'))->toBeNull();
    expect($this->repo->findActiveByCode('live'))->not->toBeNull();
});

it('invalidates the cache for a code', function (): void {
    $def = WorkflowDefinition::factory()->create(['code' => 'civic_default', 'active' => true]);

    $this->repo->findActiveByCode('civic_default');
    expect(Cache::has('workflow:def:code:civic_default'))->toBeTrue();

    $this->repo->invalidate('civic_default');
    expect(Cache::has('workflow:def:code:civic_default'))->toBeFalse();
});

it('loadGraph returns the states keyed by code and the transitions array', function (): void {
    $def = WorkflowDefinition::factory()->create(['code' => 'civic_default']);
    $draft = WorkflowState::factory()->create(['workflow_definition_id' => $def->id, 'code' => 'draft']);
    $submitted = WorkflowState::factory()->create(['workflow_definition_id' => $def->id, 'code' => 'submitted']);
    WorkflowTransition::factory()->create([
        'workflow_definition_id' => $def->id,
        'from_state_id' => $draft->id,
        'to_state_id' => $submitted->id,
    ]);

    $graph = $this->repo->loadGraph('civic_default');
    expect($graph)->not->toBeNull();
    expect($graph['definition']->id)->toBe($def->id);
    expect($graph['states'])->toHaveKeys(['draft', 'submitted']);
    expect($graph['transitions'])->toHaveCount(1);
});
