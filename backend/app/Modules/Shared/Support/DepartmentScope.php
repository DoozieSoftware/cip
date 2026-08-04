<?php

declare(strict_types=1);

namespace App\Modules\Shared\Support;

use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;

/**
 * Phase 1 department data isolation
 * (docs/department-routing-implementation-plan.md §3.6, audit items C5–C8).
 *
 * Staff splits into two groups:
 *  - UNRESTRICTED (moderator / super_admin / system) may see every report
 *  - DEPARTMENT-scoped (department_officer / department_admin / legacy
 *    `department` role) may only see reports their own departments own or
 *    hold an open assignment on (primary now; secondary from Track B)
 *
 * BasePolicy::before() still short-circuits super_admin / system at the
 * policy layer; this helper centralises the same rule for controllers and
 * repositories that bypass policies.
 */
final class DepartmentScope
{
    private const UNRESTRICTED_ROLES = ['moderator', 'super_admin', 'system'];

    private const DEPARTMENT_ROLES = ['department_officer', 'department_admin', 'department'];

    public static function isUnrestrictedStaff(User $user): bool
    {
        return $user->hasAnyRole(self::UNRESTRICTED_ROLES);
    }

    public static function isDepartmentScopedStaff(User $user): bool
    {
        return ! self::isUnrestrictedStaff($user) && $user->hasAnyRole(self::DEPARTMENT_ROLES);
    }

    /**
     * Department ids the user belongs to.
     *
     * @return list<string>
     */
    public static function memberDepartmentIds(User $user): array
    {
        $ids = $user->departments()->pluck('departments.id')->all();

        return array_values(array_filter($ids, 'is_string'));
    }

    /**
     * Can this staff member see the report? Unrestricted staff always;
     * department staff only through ownership or an open assignment.
     */
    public static function canViewReport(User $user, Report $report): bool
    {
        if (self::isUnrestrictedStaff($user)) {
            return true;
        }

        if (! self::isDepartmentScopedStaff($user)) {
            return false;
        }

        $departmentIds = self::memberDepartmentIds($user);

        if ($departmentIds === []) {
            return false;
        }

        if ($report->department_id !== null && in_array($report->department_id, $departmentIds, true)) {
            return true;
        }

        return $report->assignments()
            ->open()
            ->whereIn('department_id', $departmentIds)
            ->exists();
    }
}
