<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);


it('creates the workflow_transitions table with the expected columns', function (): void {
    expect(Schema::hasTable('workflow_transitions'))->toBeTrue();

    foreach ([
        'id', 'workflow_definition_id', 'from_state_id', 'to_state_id', 'event',
        'required_role', 'required_permission', 'conditions',
        'sla_minutes', 'notify_before_minutes', 'priority', 'active',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('workflow_transitions', $col))->toBeTrue();
    }
});

it('has the engine-resolution index (from_state_id, event, priority)', function (): void {
    $indexes = collect(Schema::getIndexes('workflow_transitions'));
    $hit = $indexes->first(fn ($i) => $i['name'] === 'idx_workflow_trans_from_event_pri');
    expect($hit)->not->toBeNull();
    expect($hit['columns'])->toBe(['from_state_id', 'event', 'priority']);
});

it('enforces all three FKs (definition, from_state, to_state)', function (): void {
    $defId = (string) Str::uuid();
    DB::table('workflow_definitions')->insert([
        'id' => $defId,
        'name' => 'Test',
        'code' => 'wfk_'.uniqid(),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $fromId = (string) Str::uuid();
    $toId = (string) Str::uuid();

    foreach ([$fromId, $toId] as $sid) {
        DB::table('workflow_states')->insert([
            'id' => $sid,
            'workflow_definition_id' => $defId,
            'code' => 's_'.substr($sid, 0, 8),
            'name' => 'State '.$sid,
            'is_initial' => false,
            'is_terminal' => false,
            'sort_order' => 0,
            'color' => '#000000',
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // A transition with an orphan to_state_id must fail.
    expect(fn () => DB::table('workflow_transitions')->insert([
        'id' => (string) Str::uuid(),
        'workflow_definition_id' => $defId,
        'from_state_id' => $fromId,
        'to_state_id' => (string) Str::uuid(),
        'event' => 'submit',
        'priority' => 0,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});
