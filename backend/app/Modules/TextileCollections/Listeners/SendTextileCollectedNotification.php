<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionCollected;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches the `textile.collected` email when a request is marked
 * picked_up. The actual bags/weight captured at the doorstep is
 * preferred; falls back to the estimate when the staff didn't log one.
 */
final class SendTextileCollectedNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileCollectionCollected $event): void
    {
        $collection = $event->collection->loadMissing(['citizen', 'department']);
        $citizen = $collection->citizen;

        if (! $citizen instanceof User) {
            Log::info('textile.collected skipped: no citizen user on the request', [
                'collection_id' => $collection->id,
                'reference' => $collection->reference,
            ]);

            return;
        }

        $bags = $collection->actual_bags ?? $collection->estimated_bags;
        $weight = $collection->actual_weight_kg ?? $collection->estimated_weight_kg;
        $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

        try {
            $this->dispatcher->dispatch($citizen, 'textile.collected', [
                'name' => (string) ($citizen->name ?? ''),
                'tracking_number' => $collection->reference,
                'bags' => (int) $bags,
                'weight' => (string) $weight,
                'partner' => $partnerName,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            Log::warning('failed to dispatch textile.collected notification', [
                'collection_id' => $collection->id,
                'user_id' => $citizen->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
