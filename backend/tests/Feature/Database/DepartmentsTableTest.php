<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('creates the departments table with the required columns', function (): void {
    expect(Schema::hasTable('departments'))->toBeTrue();

    foreach ([
        'id', 'name', 'code', 'parent_id', 'jurisdiction', 'address',
        'email', 'phone', 'working_hours', 'holiday_calendar',
        'default_workflow_id', 'default_sla_minutes', 'escalation_matrix',
        'active', 'created_at', 'updated_at', 'deleted_at',
    ] as $column) {
        expect(Schema::hasColumn('departments', $column))->toBeTrue("departments.{$column} must exist");
    }
});

it('enforces a unique index on departments.code', function (): void {
    $now = now();
    DB::table('departments')->insert([
        'id' => (string) Str::uuid(),
        'name' => 'Public Works',
        'code' => 'PWD',
        'default_sla_minutes' => 2880,
        'active' => true,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    expect(fn () => DB::table('departments')->insert([
        'id' => (string) Str::uuid(),
        'name' => 'Public Works (clone)',
        'code' => 'PWD',
        'default_sla_minutes' => 2880,
        'active' => true,
        'created_at' => $now,
        'updated_at' => $now,
    ]))->toThrow(QueryException::class);
});

it('rejects a parent_id that does not reference departments.id', function (): void {
    $now = now();
    expect(fn () => DB::table('departments')->insert([
        'id' => (string) Str::uuid(),
        'name' => 'Orphan',
        'code' => 'ORPHAN',
        'parent_id' => '00000000-0000-0000-0000-000000000000',
        'default_sla_minutes' => 2880,
        'active' => true,
        'created_at' => $now,
        'updated_at' => $now,
    ]))->toThrow(QueryException::class);
});

it('nulls parent_id when the parent department is deleted (manual cascade)', function (): void {
    $now = now();
    $parentId = (string) Str::uuid();
    $childId = (string) Str::uuid();

    DB::table('departments')->insert([
        'id' => $parentId, 'name' => 'Parent', 'code' => 'PAR',
        'default_sla_minutes' => 2880, 'active' => true,
        'created_at' => $now, 'updated_at' => $now,
    ]);
    DB::table('departments')->insert([
        'id' => $childId, 'name' => 'Child', 'code' => 'CHILD',
        'parent_id' => $parentId, 'default_sla_minutes' => 2880,
        'active' => true, 'created_at' => $now, 'updated_at' => $now,
    ]);

    DB::table('departments')->where('id', $parentId)->delete();

    $child = DB::table('departments')->where('id', $childId)->first();
    expect($child->parent_id)->toBeNull();
});

it('soft-delete column (deleted_at) is nullable', function (): void {
    $now = now();
    $id = (string) Str::uuid();

    DB::table('departments')->insert([
        'id' => $id, 'name' => 'Soft', 'code' => 'SOFT',
        'default_sla_minutes' => 2880, 'active' => true,
        'created_at' => $now, 'updated_at' => $now,
    ]);

    $row = DB::table('departments')->where('id', $id)->first();
    expect($row->deleted_at)->toBeNull();
});
