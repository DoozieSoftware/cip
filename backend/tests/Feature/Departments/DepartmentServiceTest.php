<?php

declare(strict_types=1);

use App\Modules\Departments\Events\DepartmentCreated;
use App\Modules\Departments\Events\DepartmentDeleted;
use App\Modules\Departments\Events\DepartmentUpdated;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentRepository;
use App\Modules\Departments\Services\DepartmentService;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Facades\Event;

it('creates a department, persists it, and emits DepartmentCreated', function (): void {
    Event::fake([DepartmentCreated::class]);

    $service = new DepartmentService(new DepartmentRepository);
    $dept = $service->create([
        'name' => 'Public Works',
        'code' => 'PWD',
        'jurisdiction' => 'City-wide',
        'active' => true,
    ]);

    expect($dept)->toBeInstanceOf(Department::class)
        ->and($dept->code)->toBe('PWD')
        ->and($dept->active)->toBeTrue();
    Event::assertDispatched(DepartmentCreated::class, fn (DepartmentCreated $e): bool => $e->departmentId === $dept->id);
});

it('rejects a duplicate code with a 422 ApiException', function (): void {
    Department::factory()->create(['code' => 'DUP']);
    $service = new DepartmentService(new DepartmentRepository);

    expect(fn () => $service->create(['name' => 'Other', 'code' => 'DUP']))
        ->toThrow(ApiException::class);
});

it('rejects a parent that does not exist', function (): void {
    $service = new DepartmentService(new DepartmentRepository);

    expect(fn () => $service->create([
        'name' => 'Child',
        'code' => 'CHILD',
        'parent_id' => '00000000-0000-0000-0000-000000000000',
    ]))->toThrow(ApiException::class);
});

it('rejects a parent that is itself (cycle)', function (): void {
    $service = new DepartmentService(new DepartmentRepository);
    $dept = $service->create(['name' => 'A', 'code' => 'A']);

    expect(fn () => $service->update($dept, ['parent_id' => $dept->id]))
        ->toThrow(ApiException::class);
});

it('updates a department and emits DepartmentUpdated with before/after', function (): void {
    Event::fake([DepartmentUpdated::class]);
    $dept = Department::factory()->create(['name' => 'Old', 'code' => 'OLD']);
    $service = new DepartmentService(new DepartmentRepository);

    $updated = $service->update($dept, ['name' => 'New']);

    expect($updated->name)->toBe('New');
    Event::assertDispatched(DepartmentUpdated::class, function (DepartmentUpdated $e) use ($dept): bool {
        return $e->departmentId === $dept->id
            && $e->before['name'] === 'Old'
            && $e->after['name'] === 'New';
    });
});

it('soft-deletes a department and emits DepartmentDeleted', function (): void {
    Event::fake([DepartmentDeleted::class]);
    $dept = Department::factory()->create();
    $service = new DepartmentService(new DepartmentRepository);

    $service->delete($dept);

    expect(Department::query()->find($dept->id))->toBeNull()
        ->and(Department::onlyTrashed()->find($dept->id))->not->toBeNull();
    Event::assertDispatched(DepartmentDeleted::class, fn (DepartmentDeleted $e): bool => $e->departmentId === $dept->id);
});

it('rejects an invalid escalation_matrix', function (): void {
    $service = new DepartmentService(new DepartmentRepository);

    expect(fn () => $service->create([
        'name' => 'A',
        'code' => 'A',
        'escalation_matrix' => 'not-an-array',
    ]))->toThrow(ApiException::class);

    expect(fn () => $service->create([
        'name' => 'B',
        'code' => 'B',
        'escalation_matrix' => [['escalate_to_role' => 'admin']], // missing after_minutes
    ]))->toThrow(ApiException::class);
});

it('accepts a valid escalation_matrix', function (): void {
    $service = new DepartmentService(new DepartmentRepository);
    $dept = $service->create([
        'name' => 'C',
        'code' => 'C',
        'escalation_matrix' => [
            ['after_minutes' => 60, 'escalate_to_role' => 'department_admin'],
        ],
    ]);

    expect($dept->escalation_matrix[0]['after_minutes'])->toBe(60);
});
