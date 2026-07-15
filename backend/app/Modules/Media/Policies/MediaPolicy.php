<?php

declare(strict_types=1);

namespace App\Modules\Media\Policies;

use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Policies\BasePolicy;
use App\Modules\Users\Models\User;

/**
 * MediaPolicy per docs/11 §15.
 *
 *  - view     : owner of the parent report (citizen) OR
 *               staff (moderator / department / super_admin)
 *  - download : false for everyone by default — clients must
 *               hit the temporary-signed serve route, which
 *               has its own signed-URL gate. This is a
 *               defence-in-depth deny so even a logged-in
 *               staff member cannot bypass the TTL by hitting
 *               a non-signed download endpoint.
 *  - update   : false — the evidence is immutable. Replacements
 *               go through the chain-of-custody flow (M5-016).
 *  - delete   : staff only (M16 hardening uses this for
 *               purges after retention windows).
 */
class MediaPolicy extends BasePolicy
{
    private const STAFF_ROLES = ['moderator', 'department_officer', 'department', 'super_admin', 'system'];

    public function view(User $user, Media $media): bool
    {
        $report = Report::query()->find($media->report_id);

        return $report !== null && $this->viewReport($user, $report);
    }

    public function viewReport(User $user, Report $report): bool
    {
        return $this->isOwner($user, $report) || $user->hasAnyRole(self::STAFF_ROLES);
    }

    public function download(User $user, Media $media): bool
    {
        // Defence in depth — the signed-URL serve route is
        // the actual download path. Even an authenticated
        // staff member must use a fresh temporary signed URL.
        return false;
    }

    public function update(User $user, Media $media): bool
    {
        return false;
    }

    public function delete(User $user, Media $media): bool
    {
        return $user->hasAnyRole(['super_admin', 'system']);
    }

    private function isOwner(User $user, Report $report): bool
    {
        return (string) $report->citizen_id === (string) $user->id;
    }
}
