<?php

declare(strict_types=1);

namespace App\Modules\Shared\Policies;

use Illuminate\Auth\Access\HandlesAuthorization;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Base policy. Concrete policies extend this class to inherit the
 * "super_admin bypass" semantics. The user argument is typed as the
 * framework-wide {@see Authenticatable} contract so the base class
 * does not depend on a concrete user module.
 */
abstract class BasePolicy
{
    use HandlesAuthorization;

    public function before(Authenticatable $user, string $ability): ?bool
    {
        if (method_exists($user, 'hasRole')) {
            $hasRole = [$user, 'hasRole'];

            if ($hasRole('super_admin')) {
                return true;
            }
        }

        return null;
    }
}
