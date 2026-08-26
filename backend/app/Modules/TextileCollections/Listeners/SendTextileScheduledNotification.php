<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionScheduled;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches the `textile.scheduled` SMS once per request attached to a
 * newly scheduled batch. Each request's citizen is the recipient.
 */
final class SendTextileScheduledNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileCollectionScheduled $event): void
    {
        $batch = $event->batch->loadMissing([
            'requests.citizen',
            'requests.department',
            'serviceZone',
        ]);

        $date = $batch->collection_date->toDateString();
        $window = $this->formatWindow($batch->window_start, $batch->window_end);

        foreach ($batch->requests as $collection) {
            $citizen = $collection->citizen;

            if (! $citizen instanceof User) {
                Log::info('textile.scheduled skipped: no citizen user on the request', [
                    'collection_id' => $collection->id,
                    'reference' => $collection->reference,
                ]);
                continue;
            }

            $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

            try {
                $this->dispatcher->dispatch($citizen, 'textile.scheduled', [
                    'name' => (string) ($citizen->name ?? ''),
                    'date' => $date,
                    'window' => $window,
                    'tracking_number' => $collection->reference,
                    'partner' => $partnerName,
                ], null, [
                    'channel' => 'sms',
                ]);
            } catch (Throwable $e) {
                Log::warning('failed to dispatch textile.scheduled notification', [
                    'collection_id' => $collection->id,
                    'user_id' => $citizen->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function formatWindow(?string $start, ?string $end): string
    {
        if ($start === null || $start === '' || $end === null || $end === '') {
            return 'all day';
        }

        return $start.'-'.$end;
    }
}
