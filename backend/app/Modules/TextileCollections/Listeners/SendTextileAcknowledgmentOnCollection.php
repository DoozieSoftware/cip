<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionAcknowledged;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches the `textile.acknowledged` email to the citizen who
 * submitted a standalone textile collection request.
 */
final class SendTextileAcknowledgmentOnCollection
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileCollectionAcknowledged $event): void
    {
        $collection = $event->collection->loadMissing(['citizen', 'serviceZone', 'department']);
        $citizen = $collection->citizen;

        if (! $citizen instanceof User) {
            Log::info('textile.acknowledged skipped: no citizen user on the request', [
                'collection_id' => $collection->id,
                'reference' => $collection->reference,
            ]);

            return;
        }

        $zoneName = $collection->serviceZone !== null ? (string) $collection->serviceZone->name : '';
        $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

        try {
            $this->dispatcher->dispatch($citizen, 'textile.acknowledged', [
                'name' => (string) ($citizen->name ?? ''),
                'tracking_number' => $collection->reference,
                'bags' => (int) $collection->estimated_bags,
                'weight' => (string) $collection->estimated_weight_kg,
                'zone' => $zoneName,
                'partner' => $partnerName,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            Log::warning('failed to dispatch textile.acknowledged notification', [
                'collection_id' => $collection->id,
                'user_id' => $citizen->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
