<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\AI\Events\AiCompleted;
use App\Modules\Notifications\Services\NotificationDispatcher;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Translates an `AiCompleted` event into a citizen
 * notification when the AI produced a high-confidence
 * classification (so the citizen gets an immediate
 * acknowledgement). The template code is
 * `ai.classified`; the AI label, confidence, and the
 * recommended category are passed as variables.
 *
 * The listener intentionally does NOT push a notification
 * for low-confidence cases — those go to the moderator
 * queue (M10), not the citizen inbox.
 */
class AiCompletedListener
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function handle(AiCompleted $event): void
    {
        $report = Report::query()->find($event->reportId);

        if ($report === null || $report->citizen_id === null || $report->citizen_id === '') {
            return;
        }

        $user = User::query()->find($report->citizen_id);

        if ($user === null) {
            return;
        }

        try {
            $this->dispatcher->dispatch($user, 'ai.classified', [
                'report_id' => $report->id,
                'tracking_number' => $report->tracking_number,
                'title' => $report->title,
                'ai_label' => (string) ($event->aiLabel ?? ''),
                'category' => (string) ($event->categoryCode ?? ''),
                'severity' => (string) ($event->severityCode ?? ''),
            ], null, [
                'channel' => 'email',
            ]);
        } catch (Throwable $e) {
            // Swallow logging failures too — the routing
            // event is the source of truth and the
            // notification is a downstream side effect.
            try {
                Log::warning('failed to dispatch ai.classified notification', [
                    'report_id' => $event->reportId,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable) {
                // ignore
            }
        }
    }
}
