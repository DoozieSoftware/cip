<?php

declare(strict_types=1);

namespace App\Modules\Shared\Services;

use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Returns the platform's single "system" user - the
 * actor that backfills audit + workflow transitions for
 * background jobs, AI workers, and other internal
 * processes that have no human actor.
 *
 * The system user is created on first use and tagged with
 * the `system` Spatie role so the BasePolicy `before()`
 * hook treats it as a bypass role. The user is hidden
 * from the citizen / staff UI and never receives
 * notifications.
 *
 * The user is soft-deletable but should never be hard
 * deleted - the rows it owns in `report_status_history`
 * and `audit_logs` rely on the foreign key.
 */
class SystemUserService
{
    public const SYSTEM_USER_EMAIL = 'system@internal.civic-platform';

    public const SYSTEM_USER_MOBILE = '+0000000000';

    public function user(): User
    {
        $existing = User::query()->where('email', self::SYSTEM_USER_EMAIL)->first();

        if ($existing !== null) {
            return $existing;
        }

        return DB::transaction(function (): User {
            $user = User::query()->create([
                'id' => (string) Str::uuid(),
                'name' => 'System',
                'email' => self::SYSTEM_USER_EMAIL,
                'mobile' => self::SYSTEM_USER_MOBILE,
                'password' => bcrypt(Str::random(64)),
                'status' => 'active',
                'locale' => 'en',
            ]);

            // The system actor is granted every operational
            // role so the workflow engine's role gates (e.g.
            // `assign` requires `moderator`) accept the
            // system as a valid actor. Spatie roles are
            // additive so the system retains its `system`
            // identity while acting as a moderator for
            // auto-routing.
            $user->assignRole('system');
            $user->assignRole('moderator');

            return $user;
        });
    }
}
