<?php

declare(strict_types=1);

namespace App\Modules\Shared\Policies;

use App\Modules\Users\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Base policy. Concrete policies extend this class to inherit the
 * platform-wide authorization rules. The user argument is typed as
 * the framework {@see Authenticatable} contract in the `before()`
 * hook so the base class does not depend on a concrete user module,
 * but the helpers below narrow the type to the platform's User
 * model.
 *
 * Per docs/03 §14 and docs/11 §9. `before()` answers in this order:
 *
 *  1. No authenticated user → deny.
 *  2. Soft-deleted user → deny.
 *  3. Inactive (suspended/disabled) user → deny.
 *  4. super_admin → allow (bypass).
 *  5. system → allow (internal jobs / AI worker).
 *  6. Otherwise → defer to the concrete policy method.
 */
abstract class BasePolicy
{
    use HandlesAuthorization;

    /**
     * Roles that always bypass per-ability checks.
     */
    private const BYPASS_ROLES = ['super_admin', 'system'];

    /**
     * User statuses that are explicitly denied, regardless of role.
     */
    private const DENIED_STATUSES = ['suspended', 'disabled', 'pending'];

    public function before(Authenticatable $user, string $ability): ?bool
    {
        if (! $user instanceof User) {
            return false;
        }

        if ($user->trashed()) {
            return false;
        }

        if (in_array((string) $user->status, self::DENIED_STATUSES, true)) {
            return false;
        }

        if ($user->hasAnyRole(self::BYPASS_ROLES)) {
            return true;
        }

        return null;
    }
}
