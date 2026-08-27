<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class TextileReminderService
{
    /**
     * Send reminders for scheduled premises pickups due soon.
     *
     * Suppression: skip cancelled, rejected, picked_up, received_at_centre, missed.
     * Idempotent: skip where reminder_sent_at is already set for the current scheduled_date.
     *
     * @return int number of reminders dispatched
     */
    public function dispatchDueReminders(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        // Remind for pickups scheduled tomorrow (or today if window later today).
        $targetDates = [
            $now->copy()->addDay()->toDateString(),
            $now->toDateString(),
        ];

        $candidates = TextileCollectionRequest::query()
            ->where('collection_method', 'premises')
            ->where('status', TextileCollectionRequest::STATUS_SCHEDULED)
            ->whereIn('scheduled_date', $targetDates)
            ->whereNull('reminder_sent_at')
            ->with(['citizen', 'serviceZone', 'department', 'batch'])
            ->get();

        $sent = 0;

        foreach ($candidates as $collection) {
            // Double-check suppression — status may have changed after query
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
                continue;
            }

            $citizen = $collection->citizen;

            if (! $citizen) {
                continue;
            }

            try {
                app(NotificationDispatcher::class)->dispatch(
                    $citizen,
                    'textile.pickup_reminder',
                    [
                        'name' => (string) ($citizen->name ?? ''),
                        'date' => $collection->scheduled_date?->toDateString() ?? '',
                        'window' => $this->formatWindow($collection->scheduled_window_start, $collection->scheduled_window_end),
                        'tracking_number' => $collection->reference,
                        'partner' => $collection->department?->name ?? 'Dr. Linen',
                    ],
                    null,
                    ['channel' => 'sms'],
                );

                DB::table('textile_collection_requests')
                    ->where('id', $collection->id)
                    ->whereNull('reminder_sent_at')
                    ->update(['reminder_sent_at' => now(), 'updated_at' => now()]);

                $sent++;
            } catch (\Throwable $e) {
                Log::warning('failed to dispatch textile.pickup_reminder', [
                    'collection_id' => $collection->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }

    private function formatWindow(?string $start, ?string $end): string
    {
        if ($start === null || $start === '' || $end === null || $end === '') {
            return 'all day';
        }

        return $start.'-'.$end;
    }
}
