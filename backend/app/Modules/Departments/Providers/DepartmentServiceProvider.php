<?php

declare(strict_types=1);

namespace App\Modules\Departments\Providers;

use App\Modules\Departments\Policies\DepartmentPolicy;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * M11 — Operations portal (Department) provider.
 *
 * The M11 surface (department-officer dashboard, list, lifecycle
 * actions, internal notes) lives on the `Report` model, but the
 * M10 ModerationPolicy is already registered against `Report::class`
 * for the moderator surface. Laravel only allows ONE policy per
 * class on the Gate, so this provider wires the M11 abilities via
 * `Gate::define()` callbacks that delegate to a shared
 * `DepartmentPolicy` instance, and uses a `Gate::before()` callback
 * to honor the platform-wide super_admin / system / suspended /
 * soft-deleted bypass that lives on `BasePolicy::before()`.
 *
 * The same policy class is still used directly by unit-style
 * callers (and by the M11 policy test) because it remains a fully
 * functional `BasePolicy` subclass.
 */
class DepartmentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
    }

    public function boot(): void
    {
        $this->registerGateBefore();
        $this->registerDepartmentAbilities();
    }

    /**
     * Mirror the BasePolicy::before() checks at the Gate level so
     * the M11 abilities (registered as Gate::define callbacks)
     * honor the platform-wide bypass. Without this hook the
     * `can:view,report` middleware would not let a `super_admin`
     * through because the underlying callback only checks the
     * department-membership predicate.
     */
    private function registerGateBefore(): void
    {
        Gate::before(function (mixed $user, string $ability): ?bool {
            if (! $user instanceof User) {
                return false;
            }
            if (method_exists($user, 'trashed') && $user->trashed()) {
                return false;
            }
            $denied = ['suspended', 'disabled', 'pending'];
            if (isset($user->status) && in_array((string) $user->status, $denied, true)) {
                return false;
            }
            if (method_exists($user, 'hasAnyRole')
                && $user->hasAnyRole(['super_admin', 'system'])) {
                return true;
            }
            return null;
        });
    }

    /**
     * Register the M11 abilities on the Gate.
     *
     * Each callback resolves a fresh `DepartmentPolicy` instance
     * and delegates, so the M11 surface stays in lockstep with
     * the policy class used by the unit-style tests.
     */
    private function registerDepartmentAbilities(): void
    {
        $policy = static fn (): DepartmentPolicy => app(DepartmentPolicy::class);

        // No-arg abilities
        Gate::define('viewDashboard', static fn (User $user): bool => $policy()->viewDashboard($user));
        Gate::define('viewReports', static fn (User $user): bool => $policy()->viewReports($user));
        Gate::define('viewAudit', static fn (User $user): bool => $policy()->viewAudit($user));

        // Report-bound abilities
        Gate::define('view', static fn (User $user, Report $report): bool => $policy()->view($user, $report));
        Gate::define('accept', static fn (User $user, Report $report): bool => $policy()->accept($user, $report));
        Gate::define('start', static fn (User $user, Report $report): bool => $policy()->start($user, $report));
        Gate::define('progress', static fn (User $user, Report $report): bool => $policy()->progress($user, $report));
        Gate::define('resolve', static fn (User $user, Report $report): bool => $policy()->resolve($user, $report));
        Gate::define('close', static fn (User $user, Report $report): bool => $policy()->close($user, $report));
        Gate::define('addNote', static fn (User $user, Report $report): bool => $policy()->addNote($user, $report));
    }
}
