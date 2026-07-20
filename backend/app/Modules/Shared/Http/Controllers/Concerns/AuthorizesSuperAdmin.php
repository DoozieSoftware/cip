<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Controllers\Concerns;

use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\Request;

/**
 * Shared guard for Super Admin (`/api/v1/admin/*`) controllers.
 *
 * The `super_admin` role gate ultimately lives on each Form Request's
 * `authorize()`; controllers that also expose read-only actions
 * (index/show/destroy/evaluate) call this defensively so the check is
 * uniform across every admin module.
 */
trait AuthorizesSuperAdmin
{
    protected function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
