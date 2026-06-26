<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('creates the workflow_states table with the expected columns', function (): void {
    expect(Schema::hasTable('workflow_states'))->toBeTrue();

    foreach ([
        'id', 'workflow_definition_id', 'code', 'name', 'description',
        'is_initial', 'is_terminal', 'sort_order', 'color', 'active',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('workflow_states', $col))->toBeTrue();
    }
});

it('enforces the (workflow_definition_id, code) uniqueness and the FK', function (): void {
    $defId = (string) Str::uuid();
    DB::table('workflow_definitions')->insert([
        'id' => $defId,
        'name' => 'Test',
        'code' => 'test_'.uniqid(),
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $stateId = (string) Str::uuid();
    DB::table('workflow_states')->insert([
        'id' => $stateId,
        'workflow_definition_id' => $defId,
        'code' => 'draft',
        'name' => 'Draft',
        'is_initial' => true,
        'is_terminal' => false,
        'sort_order' => 1,
        'color' => '#888888',
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // Duplicate (def, code) must fail.
    expect(fn () => DB::table('workflow_states')->insert([
        'id' => (string) Str::uuid(),
        'workflow_definition_id' => $defId,
        'code' => 'draft',
        'name' => 'Draft 2',
        'is_initial' => false,
        'is_terminal' => false,
        'sort_order' => 2,
        'color' => '#999999',
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);

    // FK to a non-existent definition must fail.
    expect(fn () => DB::table('workflow_states')->insert([
        'id' => (string) Str::uuid(),
        'workflow_definition_id' => (string) Str::uuid(),
        'code' => 'orphan',
        'name' => 'Orphan',
        'is_initial' => false,
        'is_terminal' => false,
        'sort_order' => 1,
        'color' => '#cccccc',
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});
