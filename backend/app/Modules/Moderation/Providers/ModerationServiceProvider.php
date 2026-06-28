<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Providers;

use App\Modules\Moderation\Policies\ModerationPolicy;
use App\Modules\Reports\Models\Report;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Moderation module service provider.
 *
 * Wires the module's service container bindings and registers
 * event listeners that translate M4/M6/M7/M8 events into
 * moderator-facing audit + workflow transitions.
 *
 * Per docs/03 §6 the moderation surface is the single
 * human-decision point in the pipeline; every state change
 * initiated by a moderator is recorded in `report_status_history`
 * and `audit_logs` (handled by the underlying Workflow + Audit
 * middleware, not by the provider itself).
 *
 * The provider registers the ModerationPolicy with the Gate
 * for the Report model, plus the non-resource abilities
 * `viewQueue` and `viewAnalytics` which the dashboard
 * surfaces call directly.
 */
class ModerationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // No container bindings yet; the moderation service
        // resolves its dependencies through the constructor
        // (autowiring) and uses the workflow / report repos
        // that the M6 + M4 modules already publish.
    }

    public function boot(): void
    {
        Gate::policy(Report::class, ModerationPolicy::class);

        // The non-resource abilities do not auto-route through
        // the policy; wire them explicitly.
        Gate::define('viewQueue', [ModerationPolicy::class, 'viewQueue']);
        Gate::define('viewAnalytics', [ModerationPolicy::class, 'viewAnalytics']);
    }
}
