<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;

it('uses a UUID primary key, soft deletes, and the departments table', function (): void {
    $dept = new Department;
    expect($dept->getTable())->toBe('departments')
        ->and($dept->getKeyName())->toBe('id')
        ->and($dept->getKeyType())->toBe('string');
});

it('casts working_hours, holiday_calendar and escalation_matrix to arrays', function (): void {
    $dept = new Department;
    $casts = $dept->getCasts();

    expect($casts)->toHaveKey('working_hours')
        ->and($casts['working_hours'])->toBe('array')
        ->and($casts)->toHaveKey('holiday_calendar')
        ->and($casts['holiday_calendar'])->toBe('array')
        ->and($casts)->toHaveKey('escalation_matrix')
        ->and($casts['escalation_matrix'])->toBe('array')
        ->and($casts)->toHaveKey('active')
        ->and($casts['active'])->toBe('boolean')
        ->and($casts)->toHaveKey('default_sla_minutes')
        ->and($casts['default_sla_minutes'])->toBe('integer');
});

it('persists a department via the factory and roundtrips the JSON casts', function (): void {
    $dept = Department::factory()->create([
        'working_hours' => ['mon' => ['09:00', '17:00']],
        'holiday_calendar' => ['2026-12-25', '2026-12-26'],
        'escalation_matrix' => [
            ['after_minutes' => 60, 'escalate_to_role' => 'department_admin'],
        ],
    ]);

    $dept->refresh();
    expect($dept->working_hours)->toBe(['mon' => ['09:00', '17:00']])
        ->and($dept->holiday_calendar)->toBe(['2026-12-25', '2026-12-26'])
        ->and($dept->escalation_matrix[0]['after_minutes'])->toBe(60)
        ->and($dept->escalation_matrix[0]['escalate_to_role'])->toBe('department_admin')
        ->and($dept->active)->toBeTrue();
});

it('exposes a parent belongsTo relation that resolves to a Department', function (): void {
    $parent = Department::factory()->create();
    $child = Department::factory()->withParent($parent)->create();

    expect($child->parent)->toBeInstanceOf(Department::class)
        ->and($child->parent->id)->toBe($parent->id)
        ->and($child->parent()->getForeignKeyName())->toBe('parent_id');
});

it('exposes a children HasMany relation', function (): void {
    $parent = Department::factory()->create();
    $a = Department::factory()->withParent($parent)->create();
    $b = Department::factory()->withParent($parent)->create();

    expect($parent->children)->toHaveCount(2)
        ->and($parent->children->pluck('id')->all())
        ->toEqualCanonicalizing([$a->id, $b->id]);
});

it('soft-deletes a department and hides it from default queries', function (): void {
    $dept = Department::factory()->create();

    $dept->delete();

    expect(Department::query()->find($dept->id))->toBeNull()
        ->and(Department::onlyTrashed()->find($dept->id))->not->toBeNull()
        ->and(Department::withTrashed()->find($dept->id))->not->toBeNull();
});

it('lets a child survive the soft-delete of its parent (parent is nulled only on hard delete)', function (): void {
    $parent = Department::factory()->create();
    $child = Department::factory()->withParent($parent)->create();

    $parent->delete(); // soft delete

    $child->refresh();
    expect($child->parent_id)->toBe($parent->id)
        ->and($child->parent)->toBeNull(); // parent is trashed, relation returns null
});
