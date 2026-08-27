<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Providers;

use App\Modules\TextileCollections\Policies\TextileCollectionPolicy;
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
    }
}
