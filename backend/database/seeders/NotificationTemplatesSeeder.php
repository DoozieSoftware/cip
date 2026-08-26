<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Notifications\Models\NotificationTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Default notification templates (V1).
 *
 * Each (code, locale) pair ships a `version = 1`, `active = true`
 * row. The dispatcher matches on `(code, locale)` and falls
 * back to `en` when the requested locale is missing. The
 * M12 Super Admin can clone a template to bump the version.
 *
 * The wording below uses "complaint" (client request). Databases
 * seeded before that rename receive the same wording through the
 * `2026_08_21_010000_rename_report_wording_in_backend_content`
 * migration, which inserts active version = 2 rows; this seeder
 * keeps skipping existing version = 1 rows.
 *
 * Variables are kept in `{curly_braces}`; the TemplateEngine
 * raises a MissingTemplateVariableException if the caller
 * does not provide every placeholder declared here.
 */
class NotificationTemplatesSeeder extends Seeder
{
    /**
     * @var list<array<string, mixed>>
     */
    private const TEMPLATES = [
        [
            'code' => 'report.assigned',
            'name' => 'Complaint Assigned',
            'channel' => 'email',
            'subject' => 'Your complaint {tracking_number} has been assigned',
            'body' => "Hi {name},\n\nYour complaint \"{title}\" (ref {tracking_number}) has been assigned to the {department} team. You can track progress in the app.\n\nThank you for helping make {city} better.",
            'variables' => ['name', 'tracking_number', 'title', 'department', 'city'],
        ],
        [
            'code' => 'report.assigned.sms',
            'name' => 'Complaint Assigned (SMS)',
            'channel' => 'sms',
            'subject' => null,
            'body' => 'CIV: complaint {tracking_number} assigned to {department}. Track in app.',
            'variables' => ['tracking_number', 'department'],
        ],
        [
            'code' => 'report.status_changed',
            'name' => 'Complaint Status Changed',
            'channel' => 'email',
            'subject' => 'Status update for {tracking_number}',
            'body' => "Hi {name},\n\nYour complaint \"{title}\" moved from {from_status} to {to_status}.\n\nTracking: {tracking_number}",
            'variables' => ['name', 'tracking_number', 'title', 'from_status', 'to_status'],
        ],
        [
            'code' => 'ai.classified',
            'name' => 'AI Classified Your Complaint',
            'channel' => 'email',
            'subject' => 'We classified your complaint {tracking_number}',
            'body' => "Hi {name},\n\nOur AI classified your complaint \"{title}\" as {category} (severity {severity}). A moderator will review it shortly.\n\nTracking: {tracking_number}",
            'variables' => ['name', 'tracking_number', 'title', 'category', 'severity'],
        ],
        [
            'code' => 'ai.completed',
            'name' => 'AI Vision Completed',
            'channel' => 'webhook',
            'subject' => 'ai.completed',
            'body' => '{"report_id":"{report_id}","ai_label":"{ai_label}","category":"{category}","severity":"{severity}","confidence":{confidence}}',
            'variables' => ['report_id', 'ai_label', 'category', 'severity', 'confidence'],
        ],
        [
            'code' => 'report.sla_breached',
            'name' => 'Complaint SLA Breached',
            'channel' => 'email',
            'subject' => 'SLA breached for complaint {tracking_number}',
            'body' => 'Complaint {tracking_number} ({title}) has exceeded the {event} SLA by {elapsed_minutes} minutes.',
            'variables' => ['tracking_number', 'title', 'event', 'elapsed_minutes'],
        ],
        [
            'code' => 'security.alert',
            'name' => 'Security Alert',
            'channel' => 'email',
            'subject' => 'Security alert on your account',
            'body' => "Hi {name},\n\nWe detected a suspicious {event_type} on your account from {ip}. If this wasn't you, please reset your password and contact support.\n\nThank you,\nCivic Platform Security",
            'variables' => ['name', 'event_type', 'ip'],
        ],
        [
            'code' => 'textile.acknowledged',
            'name' => 'Textile Collection Received',
            'channel' => 'email',
            'subject' => 'We received your textile collection request {tracking_number}',
            'body' => "Hi {name},\n\nThank you for requesting a {partner} textile collection. We have received your request (ref {tracking_number}) for the {zone} zone and will notify you once a collection date is assigned.\n\nThank you for supporting circular textiles.",
            'variables' => ['name', 'tracking_number', 'zone', 'partner'],
        ],
        [
            'code' => 'textile.scheduled',
            'name' => 'Textile Collection Scheduled',
            'channel' => 'sms',
            'subject' => null,
            'body' => 'Hi {name}, your {partner} textile collection is scheduled for {date} ({window}). Please keep the waste ready. Tracking: {tracking_number}.',
            'variables' => ['name', 'date', 'window', 'tracking_number', 'partner'],
        ],
        [
            'code' => 'textile.collected',
            'name' => 'Textile Collection Completed',
            'channel' => 'email',
            'subject' => 'Your textile collection is complete - {tracking_number}',
            'body' => "Hi {name},\n\nYour {partner} textile collection has been completed. {bags} bag(s), {weight} kg were collected. Thank you for supporting circular textiles.",
            'variables' => ['name', 'tracking_number', 'bags', 'weight', 'partner'],
        ],
        [
            'code' => 'textile.rejected',
            'name' => 'Textile Collection Rejected',
            'channel' => 'email',
            'subject' => 'Update on your textile collection request {tracking_number}',
            'body' => "Hi {name},\n\nWe regret to inform you that your textile collection request (ref {tracking_number}) cannot be fulfilled at this time.\n\nReason: {reason}\n\nIf you have any questions, please contact support.\n\nThank you,\n{partner} Collection Service",
            'variables' => ['name', 'tracking_number', 'reason', 'partner'],
        ],
    ];

    public function run(): void
    {
        foreach (self::TEMPLATES as $row) {
            $existing = NotificationTemplate::query()
                ->where('code', $row['code'])
                ->where('channel', $row['channel'])
                ->where('locale', 'en')
                ->where('version', 1)
                ->first();

            if ($existing !== null) {
                continue;
            }

            $tpl = new NotificationTemplate([
                'code' => $row['code'],
                'name' => $row['name'],
                'channel' => $row['channel'],
                'subject' => $row['subject'],
                'body' => $row['body'],
                'variables' => $row['variables'],
                'locale' => 'en',
                'version' => 1,
                'active' => true,
            ]);
            $tpl->id = (string) Str::uuid();
            $tpl->save();
        }
    }
}
