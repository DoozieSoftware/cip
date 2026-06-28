<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Exceptions\MissingTemplateVariableException;
use App\Modules\Notifications\Exceptions\TemplateNotFoundException;
use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Application entry point for sending a notification.
 *
 * The dispatcher is responsible for the *intent* of
 * "send this template to this user with these variables"
 * — it does NOT talk to providers directly. The chain is:
 *
 *   1. resolve the active template for (code, locale)
 *   2. render the subject + body
 *   3. persist a `notifications` row in `pending` state
 *   4. dispatch the queueable `SendNotificationJob`
 *
 * Failure modes:
 *  - missing/inactive template  -> raises TemplateNotFoundException
 *    (caller decides; usually a 422)
 *  - missing variable           -> raises MissingTemplateVariableException
 *    (developer error; do NOT retry)
 *  - DB failure                 -> raises, caller can retry
 *
 * On retry exhaustion, the SendNotificationJob marks
 * the row `dead` and writes an audit_logs entry.
 */
class NotificationDispatcher
{
    public function __construct(
        private readonly TemplateEngine $templates,
        private readonly NotificationPreferenceService $preferences,
    ) {}

    /**
     * Dispatch a notification to a single user.
     *
     * @param  User  $user  Recipient.
     * @param  string  $code  Template code (e.g. `report.assigned`).
     * @param  array<string, mixed>  $variables  Variable map for the body.
     * @param  string|null  $locale  Preferred locale (null = `en`).
     * @param  array<string, mixed>  $overrides  Optional overrides:
     *                                           - `channel`        : push|email|sms|webhook
     *                                           - `payload`        : extra fields merged
     *                                           - `scheduled_at`   : Carbon when to deliver
     *                                           - `device_token`   : FCM target
     *                                           - `webhook_url`    : webhook target
     * @return Notification The persisted row (in `pending` state).
     *
     * @throws TemplateNotFoundException
     * @throws MissingTemplateVariableException
     */
    public function dispatch(
        User $user,
        string $code,
        array $variables = [],
        ?string $locale = null,
        array $overrides = [],
    ): Notification {
        [$template, $rendered] = $this->templates->render($code, $variables, $locale);

        $channel = $this->resolveChannel($template, $overrides);

        if (! $this->preferences->isEnabled($user, $channel, $code)) {
            Log::channel('notifications')->info('notification suppressed by preference', [
                'user_id' => $user->id,
                'code' => $code,
                'channel' => $channel,
            ]);

            return new Notification([
                'user_id' => $user->id,
                'type' => $code,
                'channel' => $channel,
                'status' => Notification::STATUS_DEAD,
                'payload' => ['reason' => 'opted_out'],
            ]);
        }

        $payload = $this->resolvePayload($template, $overrides, $rendered, $variables);

        $notification = DB::transaction(function () use (
            $user,
            $code,
            $channel,
            $payload,
            $overrides,
        ): Notification {
            return Notification::query()->create([
                'user_id' => (string) $user->id,
                'type' => $code,
                'channel' => $channel,
                'payload' => $payload,
                'status' => Notification::STATUS_PENDING,
                'scheduled_at' => $overrides['scheduled_at'] ?? null,
                'retry_count' => 0,
            ]);
        });

        SendNotificationJob::dispatch((string) $notification->id);

        Log::channel('notifications')->info('notification dispatched', [
            'notification_id' => $notification->id,
            'user_id' => $user->id,
            'type' => $code,
            'channel' => $channel,
            'template_id' => $template->id,
        ]);

        return $notification;
    }

    /**
     * Pick the channel for this delivery.
     *
     * Resolution: explicit override > template.channel.
     */
    private function resolveChannel($template, array $overrides): string
    {
        $override = $overrides['channel'] ?? null;

        if (is_string($override) && in_array($override, ['push', 'email', 'sms', 'webhook'], true)) {
            return $override;
        }

        $templateChannel = (string) $template->channel;

        if (in_array($templateChannel, ['push', 'email', 'sms', 'webhook'], true)) {
            return $templateChannel;
        }

        throw new InvalidArgumentException(
            "Template '{$template->code}' has unsupported channel '{$templateChannel}'.",
        );
    }

    /**
     * Build the JSON payload stored on the `notifications` row.
     *
     * @param  array<string, mixed>  $overrides
     * @param  array<string, string>  $rendered
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    private function resolvePayload($template, array $overrides, array $rendered, array $variables): array
    {
        $base = [
            'template_id' => (string) $template->id,
            'template_code' => (string) $template->code,
            'rendered' => $rendered,
            'variables' => $variables,
        ];

        $extra = $overrides['payload'] ?? [];

        if (! is_array($extra)) {
            $extra = [];
        }

        // Promote the per-channel target keys from the overrides to
        // the top level of the payload so the channel can read them
        // without re-merging.
        foreach (['device_token', 'webhook_url'] as $key) {
            if (isset($extra[$key])) {
                $base[$key] = $extra[$key];
            } elseif (isset($overrides[$key])) {
                $base[$key] = $overrides[$key];
            }
        }

        return array_merge($extra, $base);
    }
}
