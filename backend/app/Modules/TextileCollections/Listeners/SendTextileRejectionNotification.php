<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionRejected;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches the `textile.rejected` email when a textile collection
 * request is rejected. The email informs the requester that the
 * request cannot be fulfilled and includes the reason.
 */
final class SendTextileRejectionNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileCollectionRejected $event): void
    {
        $collection = $event->collection->loadMissing(['citizen', 'department']);
        $citizen = $collection->citizen;

        if (! $citizen instanceof User) {
            Log::info('textile.rejected skipped: no citizen user on the request', [
                'collection_id' => $collection->id,
                'reference' => $collection->reference,
            ]);

            return;
        }

        $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

        try {
            $this->dispatcher->dispatch($citizen, 'textile.rejected', [
                'name' => (string) ($citizen->name ?? ''),
                'tracking_number' => $collection->reference,
                'reason' => $event->reason,
                'partner' => $partnerName,
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            Log::warning('failed to dispatch textile.rejected notification', [
                'collection_id' => $collection->id,
                'user_id' => $citizen->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
