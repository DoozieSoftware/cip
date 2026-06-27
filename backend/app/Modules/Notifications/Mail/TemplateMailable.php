<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Mail;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Renders a (Notification, NotificationTemplate) pair as
 * a single Mailable. The body is the rendered template;
 * the subject is the template's `subject` column (or a
 * default when null). The recipient is the user that
 * owns the notification.
 *
 * MailChannel (T-M9-007) constructs and `Mail::send()`s
 * one of these per delivery.
 */
class TemplateMailable extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly Notification $notification,
        public readonly NotificationTemplate $template,
        public readonly string $renderedBody,
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->template->subject !== null && $this->template->subject !== ''
            ? $this->template->subject
            : 'Civic Platform notification';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->renderedBody,
        );
    }
}
