<?php

declare(strict_types=1);

namespace App\Modules\Reports\Policies;

use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;

/**
 * ReportPolicy per docs/11 §9 and §27.
 *
 * BasePolicy::before() already handles super_admin / system bypass
 * and suspended / disabled / pending denial; the per-ability checks
 * below enforce ownership for citizens and the staff roles for
 * moderation / department / operations surfaces.
 *
 * - view:    owner OR staff (moderator / department / super_admin)
 * - update:  owner (only on draft) OR staff with role
 * - delete:  staff only (soft-delete, audit logged)
 * - review:  moderator / super_admin
 * - assign:  moderator / super_admin
 * - resolve: moderator / department / super_admin
 * - export:  super_admin only
 * - viewAny / viewQueue: moderator / super_admin (the review queue,
 *   duplicates and fraud lists are staff-only surfaces).
 */
class ReportPolicy extends BasePolicy
{
    private const STAFF_ROLES = ['moderator', 'department_officer', 'department', 'super_admin', 'system'];

    private const QUEUE_ROLES = ['moderator', 'super_admin'];

    /**
     * Gate for class-string resources (e.g. `authorize('viewQueue', Report::class)`
     * used by QueueController). Laravel resolves a class-string ability to
     * `viewAny`, so this is what actually protects the moderator queue.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(self::QUEUE_ROLES);
    }

    /**
     * Explicit queue ability, mirroring the moderator staff gate used by
     * the review / duplicates / fraud queues.
     */
    public function viewQueue(User $user): bool
    {
        return $user->hasAnyRole(self::QUEUE_ROLES);
    }

    public function view(User $user, Report $report): bool
    {
        if ($this->isOwner($user, $report)) {
            return true;
        }

        return $user->hasAnyRole(self::STAFF_ROLES);
    }

    public function update(User $user, Report $report): bool
    {
        if ($this->isOwner($user, $report) && $this->isDraft($report)) {
            return true;
        }

        return $user->hasAnyRole(self::STAFF_ROLES);
    }

    public function delete(User $user, Report $report): bool
    {
        return $user->hasAnyRole(self::STAFF_ROLES);
    }

    public function review(User $user, Report $report): bool
    {
        return $user->hasAnyRole(['moderator', 'super_admin']);
    }

    public function assign(User $user, Report $report): bool
    {
        return $user->hasAnyRole(['moderator', 'super_admin']);
    }

    public function resolve(User $user, Report $report): bool
    {
        return $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin']);
    }

    public function export(User $user, Report $report): bool
    {
        return $user->hasRole('super_admin');
    }

    private function isOwner(User $user, Report $report): bool
    {
        if ($report->is_anonymous) {
            return false;
        }

        return $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
    }

    private function isDraft(Report $report): bool
    {
        return $report->status !== null
            && (string) $report->status->code === 'draft';
    }
}
