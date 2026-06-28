<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Channels;

use App\Modules\Notifications\Contracts\ChannelInterface;
use App\Modules\Notifications\Mail\TemplateMailable;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\ValueObjects\ChannelResult;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Email channel: renders the template body and dispatches
 * a TemplateMailable through the configured mailer.
 *
 * In V1 the rendered body is the template text verbatim
 * (no variable interpolation — that lands with
 * TemplateEngine T-M9-011). The Mailable carries the
 * notification and template for downstream observability
 * (bounce handlers can re-resolve the row by id).
 */
class MailChannel implements ChannelInterface
{
    public function send(Notification $notification, NotificationTemplate $template): ChannelResult
    {
        $start = hrtime(true);

        $user = User::find($notification->user_id);

        if ($user === null || empty($user->email)) {
            return ChannelResult::fail(
                error: 'user has no email address',
                transient: false,
                latencyMs: (int) ((hrtime(true) - $start) / 1_000_000),
            );
        }

        try {
            Mail::to($user->email)
                ->send(new TemplateMailable($notification, $template, $template->body));

            $latencyMs = (int) ((hrtime(true) - $start) / 1_000_000);

            return ChannelResult::ok(
                latencyMs: $latencyMs,
                providerResponse: ['driver' => config('mail.default', 'smtp'), 'to' => $user->email],
            );
        } catch (Throwable $e) {
            $latencyMs = (int) ((hrtime(true) - $start) / 1_000_000);

            return ChannelResult::fail(
                error: $e->getMessage(),
                transient: true,
                latencyMs: $latencyMs,
                providerResponse: ['driver' => config('mail.default', 'smtp')],
            );
        }
    }
}
