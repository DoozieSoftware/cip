<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Listeners;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Events\TextileCollectionScheduled;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reminder helper — not event-driven. Actual dispatch is via TextileReminderService::dispatchDueReminders()
 * (scheduled job). This listener left for future event binding if needed; suppression rules centralised here too.
 */
final class SendTextilePickupReminderNotification
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    /**
     * Attempt to send a single pickup reminder for a request.
     * Suppressed for cancelled / rejected / completed.
     */
    public function sendForRequest(TextileCollectionRequest $collection): bool
    {
        if (in_array($collection->status, [
            TextileCollectionRequest::STATUS_CANCELLED,
            TextileCollectionRequest::STATUS_REJECTED,
            TextileCollectionRequest::STATUS_PICKED_UP,
            TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE,
        ], true)) {
            Log::info('textile.pickup_reminder suppressed: terminal status', [
                'collection_id' => $collection->id,
                'status' => $collection->status,
            ]);

            return false;
        }

        $citizen = $collection->citizen;
        if (! $citizen instanceof User) {
            return false;
        }

        $date = $collection->scheduled_date?->toDateString() ?? '';
        $window = $this->formatWindow($collection->scheduled_window_start, $collection->scheduled_window_end);
        $partnerName = $collection->department !== null ? $collection->department->name : 'Dr. Linen';

        try {
            $this->dispatcher->dispatch($citizen, 'textile.pickup_reminder', [
                'name' => (string) ($citizen->name ?? ''),
                'date' => $date,
                'window' => $window,
                'tracking_number' => $collection->reference,
                'partner' => $partnerName,
            ], null, ['channel' => 'sms']);

            return true;
        } catch (Throwable $e) {
            Log::warning('failed to dispatch textile.pickup_reminder', [
                'collection_id' => $collection->id,
                'error' => $e->getMessage(),
            ]);

            return false;
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
