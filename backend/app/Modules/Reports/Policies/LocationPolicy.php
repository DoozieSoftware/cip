<?php

declare(strict_types=1);

namespace App\Modules\Reports\Policies;

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;

/**
 * LocationPolicy per docs/11 §9 and §27.
 *
 * A location row is owned by the report that created it; the
 * citizen can read their own report's location, and staff with
 * the right role can read any location. The policy is intentionally
 * permissive on view (locations are linked to reports, which are
 * already policy-gated) and restrictive on write (only the
 * submitting service creates locations).
 */
class LocationPolicy extends BasePolicy
{
    private const STAFF_ROLES = ['moderator', 'department_officer', 'department', 'super_admin', 'system'];

    public function view(User $user, Location $location): bool
    {
        $report = $this->reportFor($location);

        if ($report instanceof Report && $this->isReportOwner($user, $report)) {
            return true;
        }

        return $user->hasAnyRole(self::STAFF_ROLES);
    }

    public function update(User $user, Location $location): bool
    {
        // Locations are append-only. The submitting service is the
        // only path that creates them; any update is a system job.
        return $user->hasAnyRole(['system', 'super_admin']);
    }

    public function delete(User $user, Location $location): bool
    {
        return $user->hasRole('super_admin');
    }

    private function reportFor(Location $location): ?Report
    {
        $report = Report::query()
            ->where('location_id', $location->id)
            ->first();

        return $report instanceof Report ? $report : null;
    }

    private function isReportOwner(User $user, Report $report): bool
    {
        if ($report->is_anonymous) {
            return false;
        }

        return $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
    }
}
