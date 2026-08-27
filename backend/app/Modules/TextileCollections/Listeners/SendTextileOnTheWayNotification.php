<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileTripStarted;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Partner-controlled on-the-way update when trip execution begins.
 * Triggered by TextileTripStarted. Each request citizen gets one
 * textile.on_the_way SMS. Suppressed for cancelled/rejected/completed.
 * Does not expose staff personal phone number (no phone in payload).
 */
final class SendTextileOnTheWayNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileTripStarted $event): void
    {
        $batch = $event->batch->loadMissing(['requests.citizen', 'requests.department']);

        // Idempotency: only send once per batch
        if ($batch->on_the_way_sent_at !== null) {
            Log::info('textile.on_the_way skipped: already sent', ['batch_id' => $batch->id]);

            return;
        }

        $date = $batch->collection_date->toDateString();
        $window = $this->formatWindow($batch->window_start, $batch->window_end);

        foreach ($batch->requests as $collection) {
            if (in_array($collection->status, [
                TextileCollectionRequest::STATUS_CANCELLED,
                TextileCollectionRequest::STATUS_REJECTED,
                TextileCollectionRequest::STATUS_PICKED_UP,
                TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE,
            ], true)) {
                Log::info('textile.on_the_way suppressed: terminal status', [
                    'collection_id' => $collection->id,
                    'status' => $collection->status,
                ]);
                continue;
            }

            $citizen = $collection->citizen;
            if (! $citizen instanceof User) {
                continue;
            }

            $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

            try {
                $this->dispatcher->dispatch($citizen, 'textile.on_the_way', [
                    'name' => (string) ($citizen->name ?? ''),
                    'date' => $date,
                    'window' => $window,
                    'tracking_number' => $collection->reference,
                    'partner' => $partnerName,
                ], null, ['channel' => 'sms']);
            } catch (Throwable $e) {
                Log::warning('failed to dispatch textile.on_the_way', [
                    'collection_id' => $collection->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Mark batch as notified to keep idempotency even if some dispatches were suppressed
        DB::table('textile_collection_batches')
            ->where('id', $batch->id)
            ->whereNull('on_the_way_sent_at')
            ->update(['on_the_way_sent_at' => now(), 'updated_at' => now()]);
    }

    private function formatWindow(?string $start, ?string $end): string
    {
        if ($start === null || $start === '' || $end === null || $end === '') {
            return 'all day';
        }

        return $start . '-' . $end;
    }
}
