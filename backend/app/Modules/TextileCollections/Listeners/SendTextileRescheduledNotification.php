<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionRescheduled;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Notifies the citizen when their pickup is rescheduled.
 * Suppressed for cancelled/rejected/picked_up states (guard in service, double-checked here).
 */
final class SendTextileRescheduledNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(TextileCollectionRescheduled $event): void
    {
        $collection = $event->collection->loadMissing(['citizen', 'department']);

        if (in_array($collection->status, [
            TextileCollectionRequest::STATUS_CANCELLED,
            TextileCollectionRequest::STATUS_REJECTED,
            TextileCollectionRequest::STATUS_PICKED_UP,
        ], true)) {
            Log::info('textile.rescheduled suppressed: terminal status', [
                'collection_id' => $collection->id,
                'status' => $collection->status,
            ]);

            return;
        }

        $citizen = $collection->citizen;
        if (! $citizen instanceof User) {
            Log::info('textile.rescheduled skipped: no citizen', ['collection_id' => $collection->id]);

            return;
        }

        $date = $event->newSchedule['scheduled_date'] ?? $collection->scheduled_date?->toDateString() ?? '';
        $window = $this->formatWindow(
            $event->newSchedule['scheduled_window_start'] ?? $collection->scheduled_window_start,
            $event->newSchedule['scheduled_window_end'] ?? $collection->scheduled_window_end,
        );
        $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

        try {
            $this->dispatcher->dispatch($citizen, 'textile.rescheduled', [
                'name' => (string) ($citizen->name ?? ''),
                'date' => $date,
                'window' => $window,
                'tracking_number' => $collection->reference,
                'partner' => $partnerName,
            ], null, ['channel' => 'sms']);
        } catch (Throwable $e) {
            Log::warning('failed to dispatch textile.rescheduled', [
                'collection_id' => $collection->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function formatWindow(?string $start, ?string $end): string
    {
        if ($start === null || $start === '' || $end === null || $end === '') {
            return 'all day';
        }

        return $start . '-' . $end;
    }
}
