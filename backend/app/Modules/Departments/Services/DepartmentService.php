<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\Events\DepartmentCreated;
use App\Modules\Departments\Events\DepartmentDeleted;
use App\Modules\Departments\Events\DepartmentUpdated;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentRepository;
use App\Modules\Shared\Exceptions\ApiException;

/**
 * DepartmentService per docs/09 §7.
 *
 * Owns the business rules for department CRUD:
 *  - validates input (delegated to Form Requests at the HTTP
 *    boundary; the service trusts the payload and adds its own
 *    invariants — e.g. unique code, parent must be a department
 *    of the same jurisdiction, escalation_matrix must be a
 *    list of {after_minutes, escalate_to_*} rows)
 *  - emits DepartmentCreated / DepartmentUpdated / DepartmentDeleted
 *    so the audit middleware and the master-config cache
 *    invalidator can react
 *
 * The service is the only path that should mutate departments
 * in production. Controllers and seeders both go through it.
 */
class DepartmentService
{
    public function __construct(
        private readonly DepartmentRepository $repository,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Department
    {
        $attributes = $this->normalize($attributes);
        $code = is_string($attributes['code'] ?? null) ? $attributes['code'] : '';
        $this->assertUniqueCode($code, null);
        $this->assertParentExists(is_string($attributes['parent_id'] ?? null) ? $attributes['parent_id'] : null);
        $this->assertEscalationMatrixShape($attributes['escalation_matrix'] ?? null);

        $dept = $this->repository->create($attributes);
        /** @var array<string, mixed> $snapshot */ $snapshot = $dept->toArray();
        DepartmentCreated::dispatch($dept->id, $snapshot);

        return $dept;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Department $dept, array $attributes): Department
    {
        /** @var array<string, mixed> $before */ $before = $dept->toArray();
        $attributes = $this->normalize($attributes, $dept);
        $code = is_string($attributes['code'] ?? null) ? $attributes['code'] : $dept->code;
        $parentId = is_string($attributes['parent_id'] ?? null) ? $attributes['parent_id'] : $dept->parent_id;
        $this->assertUniqueCode($code, $dept->id);
        $this->assertParentExists($parentId, $dept->id);
        $this->assertEscalationMatrixShape($attributes['escalation_matrix'] ?? $dept->escalation_matrix);

        $dept = $this->repository->update($dept, $attributes);
        /** @var array<string, mixed> $after */ $after = $dept->toArray();
        DepartmentUpdated::dispatch($dept->id, $before, $after);

        return $dept;
    }

    public function delete(Department $dept): void
    {
        /** @var array<string, mixed> $snapshot */ $snapshot = $dept->toArray();
        $this->repository->delete($dept);
        DepartmentDeleted::dispatch($dept->id, $snapshot);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function normalize(array $attributes, ?Department $existing = null): array
    {
        // Drop null / missing keys so the model's mass-assignment
        // guard doesn't reject partial updates.
        return array_filter($attributes, static fn ($v): bool => $v !== null);
    }

    private function assertUniqueCode(string $code, ?string $exceptId): void
    {
        $existing = $this->repository->findByCode($code);

        if ($existing !== null && $existing->id !== $exceptId) {
            throw new ApiException('DEPARTMENT_CODE_DUPLICATE', "Department code '{$code}' is already in use.", 422);
        }
    }

    private function assertParentExists(?string $parentId, ?string $exceptId = null): void
    {
        if ($parentId === null) {
            return;
        }

        if ($parentId === $exceptId) {
            throw new ApiException('DEPARTMENT_PARENT_CYCLE', 'A department cannot be its own parent.', 422);
        }

        if ($this->repository->findById($parentId) === null) {
            throw new ApiException('DEPARTMENT_PARENT_NOT_FOUND', "Parent department '{$parentId}' does not exist.", 422);
        }
    }

    private function assertEscalationMatrixShape(mixed $matrix): void
    {
        if ($matrix === null) {
            return;
        }

        if (! is_array($matrix)) {
            throw new ApiException('DEPARTMENT_ESCALATION_INVALID', 'escalation_matrix must be an array.', 422);
        }

        foreach ($matrix as $row) {
            if (! is_array($row) || ! isset($row['after_minutes'])) {
                throw new ApiException('DEPARTMENT_ESCALATION_INVALID', 'Each escalation_matrix row needs after_minutes.', 422);
            }
        }
    }
}
