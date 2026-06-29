<?php

declare(strict_types=1);

namespace App\Modules\Departments\Policies;

use App\Modules\Departments\Models\Department;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;

/**
 * M11 — Department-officer policy.
 *
 * Per `docs/08` §2 and `docs/11` §9. The policy gates every
 * read / write of department-owned data. The base class
 * `before()` already handles the platform-wide cases (no user,
 * soft-deleted, inactive, super_admin, system). What remains
 * here is the per-department membership check.
 *
 * The M11 routes bind this policy to the `Report` model so a
 * single `view / update / action` check covers all the
 * department endpoints. Department-officer membership is the
 * Spatie role `department` plus a row in the
 * `department_users` pivot (M:N relation). We resolve that
 * here via the `User::departments()` relation.
 *
 * @method bool viewAny(User $user)
 * @method bool view(User $user, mixed $report)
 * @method bool viewDashboard(User $user)
 * @method bool viewReports(User $user)
 * @method bool accept(User $user, mixed $report)
 * @method bool start(User $user, mixed $report)
 * @method bool progress(User $user, mixed $report)
 * @method bool resolve(User $user, mixed $report)
 * @method bool close(User $user, mixed $report)
 * @method bool addNote(User $user, mixed $report)
 * @method bool viewAudit(User $user)
 */
class DepartmentPolicy extends BasePolicy
{
    /** Roles that can act on a department officer's behalf. */
    private const DEPT_ROLES = ['department', 'department_admin', 'super_admin', 'system'];

    /**
     * Determine whether the user is a member of the given department.
     * The super_admin / system bypass is handled by the base `before()`.
     */
    public function isMember(User $user, Department $department): bool
    {
        if (! $user->hasAnyRole(self::DEPT_ROLES)) {
            return false;
        }

        // The pivot relation is exposed by `User::departments()`
        // (M:N, see T-M3-009); super_admin and system short-circuit
        // through the base `before()` so we never reach here.
        return $user->departments()->whereKey($department->getKey())->exists();
    }

    public function viewDashboard(User $user): bool
    {
        return $user->hasAnyRole(self::DEPT_ROLES);
    }

    public function viewReports(User $user): bool
    {
        return $user->hasAnyRole(self::DEPT_ROLES);
    }

    public function view(User $user, mixed $report): bool
    {
        $deptId = $report->department_id ?? null;
        if (! $deptId) {
            // An unassigned report cannot be read by a department
            // officer — only the moderator or super_admin can.
            return false;
        }
        $dept = Department::query()->find($deptId);
        if (! $dept) {
            return false;
        }

        return $this->isMember($user, $dept);
    }

    public function accept(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function start(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function progress(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function resolve(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function close(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function addNote(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    public function viewAudit(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'system', 'auditor', 'department_admin']);
    }
}
