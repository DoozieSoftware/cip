<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Jobs;

use App\Modules\TextileCollections\Services\TextileReminderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled job — dispatches pickup reminders for due scheduled requests.
 * Suppression of cancelled/rejected/completed is enforced in the service.
 * TODO D-06 OPEN: per-partner reminder timing (T-1 vs T-2) pending decision.
 */
final class SendTextilePickupRemindersJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function handle(TextileReminderService $reminders): void
    {
        $count = $reminders->dispatchDueReminders();
        Log::info('textile pickup reminders dispatched', ['count' => $count]);
    }
}
