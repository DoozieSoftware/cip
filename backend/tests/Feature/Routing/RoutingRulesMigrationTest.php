<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);


it('creates the routing_rules table with the expected columns', function (): void {
    expect(Schema::hasTable('routing_rules'))->toBeTrue();

    foreach ([
        'id', 'name', 'priority', 'conditions',
        'destination_department_id', 'default_officer_id',
        'default_priority_id', 'default_sla_minutes',
        'active', 'description',
        'created_at', 'updated_at', 'deleted_at',
    ] as $col) {
        expect(Schema::hasColumn('routing_rules', $col))->toBeTrue("missing column: {$col}");
    }
});

it('routing_rules enforces the destination_department_id FK to departments', function (): void {
    $fks = collect(Schema::getForeignKeys('routing_rules'));
    $deptFk = $fks->first(fn ($f) => in_array('destination_department_id', $f['columns'], true));

    expect($deptFk)->not->toBeNull();
    expect($deptFk['foreign_table'])->toBe('departments');
});

it('routing_rules enforces the default_priority_id FK to report_priorities', function (): void {
    $fks = collect(Schema::getForeignKeys('routing_rules'));
    $priFk = $fks->first(fn ($f) => in_array('default_priority_id', $f['columns'], true));

    expect($priFk)->not->toBeNull();
    expect($priFk['foreign_table'])->toBe('report_priorities');
});

it('routing_rules enforces the nullable default_officer_id FK to users', function (): void {
    $fks = collect(Schema::getForeignKeys('routing_rules'));
    $userFk = $fks->first(fn ($f) => in_array('default_officer_id', $f['columns'], true));

    expect($userFk)->not->toBeNull();
    expect($userFk['foreign_table'])->toBe('users');
});

it('routing_rules has a priority index for evaluation order', function (): void {
    $indexes = collect(Schema::getIndexes('routing_rules'));
    $priorityIdx = $indexes->first(fn ($i) => in_array('priority', $i['columns'], true));

    expect($priorityIdx)->not->toBeNull();
});

it('routing_rules has an active index to skip disabled rules in bulk loads', function (): void {
    $indexes = collect(Schema::getIndexes('routing_rules'));
    $activeIdx = $indexes->first(fn ($i) => in_array('active', $i['columns'], true));

    expect($activeIdx)->not->toBeNull();
});

it('routing_rules has a destination_department_id index for staff-portal filtering', function (): void {
    $indexes = collect(Schema::getIndexes('routing_rules'));
    $deptIdx = $indexes->first(fn ($i) => in_array('destination_department_id', $i['columns'], true));

    expect($deptIdx)->not->toBeNull();
});

it('routing_rules.conditions column is JSON-castable', function (): void {
    $cols = collect(Schema::getColumns('routing_rules'));
    $cond = $cols->first(fn ($c) => $c['name'] === 'conditions');

    expect($cond)->not->toBeNull();
    expect(strtolower((string) $cond['type']))->toMatch('/(json|text|jsonb)/');
});

it('routing_rules supports soft deletes via deleted_at', function (): void {
    expect(Schema::hasColumn('routing_rules', 'deleted_at'))->toBeTrue();
    $indexes = collect(Schema::getIndexes('routing_rules'));
    $deletedIdx = $indexes->first(fn ($i) => in_array('deleted_at', $i['columns'], true));
    expect($deletedIdx)->not->toBeNull();
});
