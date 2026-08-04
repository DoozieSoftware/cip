<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\Models\Department;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Resolves the operation department for a staff user (Phase 1, audit item C7).
 *
 * Rules:
 *  - super_admin / system may impersonate any active department via
 *    `?department_id=`
 *  - department staff may pass `?department_id=` only for a department they
 *    are actually a member of (the operations portal switcher relies on this)
 *  - without a parameter the first membership (alphabetical) is used, so
 *    resolution is deterministic instead of database-order dependent
 *  - no active membership → 403
 */
class OperationDepartmentResolver
{
    public function resolve(User $user, ?string $requestedDepartmentId): Department
    {
        if (
            $user->hasAnyRole(['super_admin', 'system'])
            && $requestedDepartmentId !== null
            && $requestedDepartmentId !== ''
        ) {
            $department = Department::query()
                ->whereKey($requestedDepartmentId)
                ->where('active', true)
                ->first();

            if ($department === null) {
                throw ApiException::notFound('Department');
            }

            return $department;
        }

        $memberships = $this->activeMemberships($user);
        $target = $requestedDepartmentId !== null && $requestedDepartmentId !== ''
            ? $requestedDepartmentId
            : null;

        foreach ($memberships as $department) {
            if ($target === null || $department->id === $target) {
                return $department;
            }
        }

        throw ApiException::forbidden(
            $target === null
                ? 'User is not a member of any department.'
                : 'You are not a member of the requested department.',
        );
    }

    /**
     * Active departments the user belongs to, alphabetical for a stable
     * default pick and a sorted switcher list.
     *
     * @return Collection<int, Department>
     */
    public function activeMemberships(User $user): Collection
    {
        return $user->departments()
            ->where('departments.active', true)
            ->orderBy('departments.name')
            ->get();
    }
}
