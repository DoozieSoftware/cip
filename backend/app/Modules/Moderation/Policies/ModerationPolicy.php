<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Policies;

use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;

/**
 * ModerationPolicy per docs/07 §3 (Moderator Portal — RBAC).
 *
 * Citizens are blocked from every moderation surface. Moderators
 * (and the bypass roles inherited from BasePolicy) can view the
 * queue, the per-report detail, the duplicate / fraud queues, and
 * apply the four decisions (review, merge, reject, escalate).
 *
 * Reassignment reuses the M7 `ReassignService` and is gated by
 * the same `viewQueue` ability — the dashboard shortcut uses
 * the same predicate.
 *
 * The policy is intentionally narrow: per docs/11 §9 every
 * moderation action writes a `report_status_history` row and
 * an `audit_logs` row. The audit middleware in
 * bootstrap/app.php handles the audit row; the workflow
 * engine handles the history row.
 */
class ModerationPolicy extends BasePolicy
{
    /**
     * Roles that can act on the moderation surface.
     *
     * `super_admin` and `system` are already in BasePolicy::BYPASS_ROLES
     * (and that bypass only fires through the Gate facade), so we list
     * them here too — this keeps the per-ability methods correct when
     * the policy is invoked directly (unit-style tests, future non-Gate
     * callers, and the per-ability documentation).
     */
    private const MOD_ROLES = ['moderator', 'super_admin', 'system'];

    /**
     * `viewQueue`: can list the moderator queue, duplicate queue,
     * fraud queue, and per-report detail.
     */
    public function viewQueue(User $user): bool
    {
        return $user->hasAnyRole(self::MOD_ROLES);
    }

    /**
     * `viewReport`: can open a single report's moderation detail.
     */
    public function viewReport(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `review`: can apply the approve / reject / escalate decision
     * to a single report.
     */
    public function review(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `merge`: can mark a report as a duplicate of another.
     * Same role gate as review; the service layer enforces the
     * "must point to a different report" invariant.
     */
    public function merge(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `reject`: can close a report with a rejection.
     */
    public function reject(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `escalate`: can move a report to the senior-moderator queue.
     */
    public function escalate(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `reassign`: can change the assigned department or officer.
     * Reuses the M7 ReassignService.
     */
    public function reassign(User $user, Report $report): bool
    {
        return $this->viewQueue($user);
    }

    /**
     * `viewAnalytics`: can open the moderator analytics + AI
     * performance dashboard.
     */
    public function viewAnalytics(User $user): bool
    {
        return $this->viewQueue($user);
    }
}
