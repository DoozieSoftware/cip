<?php

declare(strict_types=1);

namespace App\Modules\Departments\Repositories;

use App\Modules\Departments\Models\Department;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Read/write access to the `departments` table.
 *
 * Pure data access — no business rules, no audit emission, no
 * events. The DepartmentService owns those concerns; the
 * repository returns Eloquent models / query builders that the
 * service composes.
 */
class DepartmentRepository
{
    /**
     * @return Builder<Department>
     */
    public function query(): Builder
    {
        return Department::query();
    }

    public function findById(string $id): ?Department
    {
        return Department::query()->find($id);
    }

    public function findByCode(string $code): ?Department
    {
        return Department::query()->where('code', $code)->first();
    }

    /**
     * @param  array{
     *     q?: string|null,
     *     jurisdiction?: string|null,
     *     parent_id?: string|null,
     *     active?: bool|null,
     * }  $filters
     */
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Department>
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $q = Department::query();

        if (! empty($filters['q']) && is_string($filters['q'])) {
            $needle = '%'.$filters['q'].'%';
            $q->where(function (Builder $w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('code', 'like', $needle)
                    ->orWhere('email', 'like', $needle);
            });
        }

        if (! empty($filters['jurisdiction']) && is_string($filters['jurisdiction'])) {
            $q->where('jurisdiction', $filters['jurisdiction']);
        }

        if (! empty($filters['parent_id']) && is_string($filters['parent_id'])) {
            $q->where('parent_id', $filters['parent_id']);
        }

        if (isset($filters['active'])) {
            $q->where('active', (bool) $filters['active']);
        }

        return $q->orderBy('name')->paginate($perPage);
    }

    /**
     * @return Collection<int, Department>
     */
    public function byJurisdiction(string $jurisdiction)
    {
        return Department::query()
            ->where('jurisdiction', $jurisdiction)
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Department
    {
        return Department::query()->create($attributes);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Department $dept, array $attributes): Department
    {
        $dept->update($attributes);

        return $dept;
    }

    public function delete(Department $dept): void
    {
        $dept->delete();
    }
}
