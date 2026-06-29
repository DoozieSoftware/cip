<?php

declare(strict_types=1);

namespace App\Modules\Users\Repositories;

use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * T-M12-001 — Read-side helper for the Super Admin user list.
 *
 * Per `docs/05` §10 and `docs/09` §8 the super-admin "Users"
 * screen needs paged, filterable, searchable access to every
 * row in `users` (including soft-deleted). Writes go through
 * the controller + service.
 */
class UserRepository
{
    /**
     * @param  array{
     *     q?: ?string,
     *     role?: ?string,
     *     status?: ?string,
     *     include_trashed?: bool,
     *     only_trashed?: bool,
     *     department_id?: ?string,
     * }  $filters
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $query = User::query()->with(['roles']);

        if (! empty($filters['include_trashed'])) {
            $query->withTrashed();
        } elseif (! empty($filters['only_trashed'])) {
            $query->onlyTrashed();
        }

        if (! empty($filters['q'])) {
            $term = '%' . $filters['q'] . '%';
            $query->where(function (Builder $q) use ($term): void {
                $q->where('name', 'like', $term)
                    ->orWhere('mobile', 'like', $term)
                    ->orWhere('email', 'like', $term);
            });
        }

        if (! empty($filters['role'])) {
            $query->whereHas('roles', function (Builder $q) use ($filters): void {
                $q->where('name', $filters['role']);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['department_id'])) {
            $query->whereHas('departments', function (Builder $q) use ($filters): void {
                $q->where('departments.id', $filters['department_id']);
            });
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }
}
