<?php

declare(strict_types=1);

namespace App\Modules\Departments\Policies;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Shared\Support\DepartmentScope;
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
 * @method bool attachProof(User $user, mixed $report)
 * @method bool viewAudit(User $user)
 */
class DepartmentPolicy extends BasePolicy
{
    /** Roles that can act on a department officer's behalf. */
    private const DEPT_ROLES = ['department_officer', 'department', 'department_admin', 'super_admin', 'system'];

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
        return $this->hasRoleOrPermission($user, self::DEPT_ROLES, 'departments.view');
    }

    public function viewReports(User $user): bool
    {
        return $this->hasRoleOrPermission($user, self::DEPT_ROLES, 'reports.view_department');
    }

    public function view(User $user, mixed $report): bool
    {
        if (! $report instanceof Report) {
            return false;
        }

        return DepartmentScope::canViewReport($user, $report);
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
        if (! $report instanceof Report) {
            return false;
        }

        if (DepartmentScope::isUnrestrictedStaff($user)) {
            return true;
        }

        if (! DepartmentScope::isDepartmentScopedStaff($user) || $report->department_id === null) {
            return false;
        }

        // A linked secondary department may complete its task, but the
        // primary department remains the owner of the master complaint.
        return in_array($report->department_id, DepartmentScope::memberDepartmentIds($user), true);
    }

    public function addNote(User $user, mixed $report): bool
    {
        return $this->view($user, $report);
    }

    /**
     * Attaching proof-of-completion media has the same scoping as an
     * internal note: the caller must already be a member of the
     * department the report was assigned to.
     */
    public function attachProof(User $user, mixed $report): bool
    {
        if (! $report instanceof Report) {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'system'])) {
            return true;
        }

        if (! DepartmentScope::isDepartmentScopedStaff($user)) {
            return false;
        }

        $departmentIds = DepartmentScope::memberDepartmentIds($user);

        if ($departmentIds === []) {
            return false;
        }

        if ($report->department_id !== null && in_array((string) $report->department_id, $departmentIds, true)) {
            return true;
        }

        return $report->assignments()
            ->whereNull('reassigned_at')
            ->whereIn('task_status', [
                ReportAssignment::TASK_STATUS_OPEN,
                ReportAssignment::TASK_STATUS_COMPLETED,
            ])
            ->whereIn('department_id', $departmentIds)
            ->exists();
    }

    public function attachProofToAssignment(User $user, mixed $assignment): bool
    {
        if (! $assignment instanceof ReportAssignment) {
            return false;
        }

        if ($user->hasAnyRole(['super_admin', 'system'])) {
            return true;
        }

        return DepartmentScope::isDepartmentScopedStaff($user)
            && $assignment->reassigned_at === null
            && in_array($assignment->task_status, [
                ReportAssignment::TASK_STATUS_OPEN,
                ReportAssignment::TASK_STATUS_COMPLETED,
            ], true)
            && in_array(
                $assignment->department_id,
                DepartmentScope::memberDepartmentIds($user),
                true,
            );
    }

    public function completeTask(User $user, mixed $assignment): bool
    {
        if (! $assignment instanceof ReportAssignment) {
            return false;
        }

        if ($assignment->kind !== ReportAssignment::KIND_SECONDARY) {
            return false;
        }

        if (! $assignment->open()->whereKey($assignment->getKey())->exists()) {
            return false;
        }

        if (DepartmentScope::isUnrestrictedStaff($user)) {
            return true;
        }

        return DepartmentScope::isDepartmentScopedStaff($user)
            && in_array($assignment->department_id, DepartmentScope::memberDepartmentIds($user), true);
    }

    public function viewAudit(User $user): bool
    {
        return $this->hasRoleOrPermission($user, ['super_admin', 'system', 'auditor', 'department_admin'], 'audit.view');
    }
}
