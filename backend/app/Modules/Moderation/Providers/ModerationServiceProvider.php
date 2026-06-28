<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Providers;

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
 * The provider deliberately does NOT publish a real-time
 * push channel for moderators — the queue / detail views
 * poll (TanStack Query, 15 s refresh). M14 (External Connector
 * Framework) will replace polling with a websocket connector
 * when the platform scales past the demo.
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
        // No event subscriptions here — the moderator's own
        // actions (review, merge, reject, escalate) emit the
        // events; the listeners for those events live in
        // app/Modules/Moderation/Listeners and are auto-
        // discovered by Laravel.
    }
}
