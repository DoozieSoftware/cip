<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Providers;

use App\Modules\TextileCollections\Events\TextileCollectionRescheduled;
use App\Modules\TextileCollections\Events\TextileTripStarted;
use App\Modules\TextileCollections\Listeners\SendTextileOnTheWayNotification;
use App\Modules\TextileCollections\Listeners\SendTextileRescheduledNotification;
use App\Modules\TextileCollections\Policies\TextileCollectionPolicy;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * TextileCollections module service provider.
 *
 * Registers textile-specific Gate abilities scoped to this module
 * so they do not silently replace abilities from other modules
 * (per AGENTS.md §Gate ability names).
 */
final class TextileCollectionsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('textile.view_queue', [TextileCollectionPolicy::class, 'viewQueue']);
        Gate::define('textile.view', [TextileCollectionPolicy::class, 'view']);
        Gate::define('textile.schedule_batch', [TextileCollectionPolicy::class, 'scheduleBatch']);
        Gate::define('textile.record_outcome', [TextileCollectionPolicy::class, 'recordOutcome']);
        Gate::define('textile.cancel', [TextileCollectionPolicy::class, 'cancel']);
        Gate::define('textile.report', [TextileCollectionPolicy::class, 'report']);
        Gate::define('textile.approve', [TextileCollectionPolicy::class, 'approve']);
        Gate::define('textile.record_receipt', [TextileCollectionPolicy::class, 'recordReceipt']);
        Gate::define('textile.reverse_receipt', [TextileCollectionPolicy::class, 'reverseReceipt']);
        Gate::define('textile.manage_centre', [TextileCollectionPolicy::class, 'manageCentre']);
        Gate::define('textile.assign_trip', [TextileCollectionPolicy::class, 'assignTrip']);
        Gate::define('textile.operate_trip', [TextileCollectionPolicy::class, 'operateTrip']);
        Gate::define('textile.reschedule', [TextileCollectionPolicy::class, 'reschedule']);
        Gate::define('textile.update_instructions', [TextileCollectionPolicy::class, 'updateInstructions']);
        Gate::define('textile.view_unavailability', [TextileCollectionPolicy::class, 'viewUnavailability']);
        Gate::define('textile.manage_unavailability', [TextileCollectionPolicy::class, 'manageUnavailability']);
        Gate::define('textile.reschedule_override', [TextileCollectionPolicy::class, 'rescheduleOverride']);
        Gate::define('textile.queue_offline', [TextileCollectionPolicy::class, 'queueOffline']);
        Gate::define('textile.view_offline_queue', [TextileCollectionPolicy::class, 'viewOfflineQueue']);
        Gate::define('textile.retry_offline', [TextileCollectionPolicy::class, 'retryOffline']);
        Gate::define('textile.configure_capacity', [TextileCollectionPolicy::class, 'configureCapacity']);
        Gate::define('textile.view_capacity', [TextileCollectionPolicy::class, 'viewCapacity']);
        Gate::define('textile.request_exception', [TextileCollectionPolicy::class, 'requestException']);
        Gate::define('textile.decide_exception', [TextileCollectionPolicy::class, 'decideException']);
        Gate::define('textile.view_reports', [TextileCollectionPolicy::class, 'viewReports']);

        // Phase 3: reschedule + on-the-way notifications (suppression for cancelled enforced in listeners).
        // TODO D-06 OPEN: reminder channel/timing pending partner decision — listener is SMS by default.
        Event::listen(TextileCollectionRescheduled::class, SendTextileRescheduledNotification::class);
        Event::listen(TextileTripStarted::class, SendTextileOnTheWayNotification::class);
    }
}
