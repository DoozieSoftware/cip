<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Renames user-facing "report" wording to "complaint" in seeded,
 * backend-generated text.
 *
 * Production only runs `php artisan migrate --force` (never
 * `db:seed`), so the wording changes shipped in the updated seeders
 * are replayed here for existing databases. Three surfaces:
 *
 *  1. `notification_templates` — inserts an active `version = 2` row
 *     with complaint wording for each citizen-facing template and
 *     deactivates its `version = 1` row. TemplateEngine::resolve()
 *     picks the highest active version per (code, locale), so v2 wins
 *     at send time while v1 is retained for audit history. Template
 *     codes are machine identifiers and stay unchanged, as do the
 *     declared variables and the `CIV:` SMS prefix.
 *  2. `app_configs` — refreshes the human-readable `description`
 *     column of six feature flags (keys and values untouched).
 *  3. `workflow_definitions` — display name/description of the
 *     `civic_default` definition (code untouched).
 *  4. `report_statuses` / `workflow_states` — display-name updates
 *     for the `closed` ("Closed" → "Resolved") and `draft` ("Draft"
 *     → "Pending for Submission") states per decision D6/D8, whose
 *     seeded names leaked into emails, audit text and the admin
 *     workflow editor. Codes and all other statuses are untouched;
 *     `workflow_states` is scoped to `civic_default` via its natural
 *     key (workflow_definition_id, code).
 *
 * Idempotent: a template v2 row is inserted only when a v1 row exists
 * and no v2+ row does yet — a fresh install instead receives its v1
 * rows straight from the updated NotificationTemplatesSeeder, and a
 * Super Admin clone (v2+) is left untouched. Config/workflow writes
 * are keyed updates that converge to the same state on re-run.
 */
return new class extends Migration
{
    /**
     * Complaint-wording replacements for the citizen-facing templates.
     * Only prose changed — codes, channels, locales and declared
     * variables are identical to version 1.
     *
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
            'code' => 'report.sla_breached',
            'name' => 'Complaint SLA Breached',
            'channel' => 'email',
            'subject' => 'SLA breached for complaint {tracking_number}',
            'body' => 'Complaint {tracking_number} ({title}) has exceeded the {event} SLA by {elapsed_minutes} minutes.',
            'variables' => ['tracking_number', 'title', 'event', 'elapsed_minutes'],
        ],
    ];

    /**
     * Feature-flag description refreshes: config key => [old, new].
     *
     * @var array<string, array{old: string, new: string}>
     */
    private const CONFIG_DESCRIPTIONS = [
        'anonymous_reporting' => [
            'old' => 'Allows citizens to submit reports without authentication.',
            'new' => 'Allows citizens to submit complaints without authentication.',
        ],
        'video_mandatory' => [
            'old' => 'Require a video attachment for every report.',
            'new' => 'Require a video attachment for every complaint.',
        ],
        'public_dashboard' => [
            'old' => 'Expose the public reports dashboard without authentication.',
            'new' => 'Expose the public complaints dashboard without authentication.',
        ],
        'offline_mode' => [
            'old' => 'Citizen PWA queues reports when offline and replays on reconnect.',
            'new' => 'Citizen PWA queues complaints when offline and replays on reconnect.',
        ],
        'fraud_detection' => [
            'old' => 'AI-assisted fraud scoring on incoming reports.',
            'new' => 'AI-assisted fraud scoring on incoming complaints.',
        ],
        'duplicate_detection' => [
            'old' => 'Detect near-duplicate reports within a 50m / 14-day window.',
            'new' => 'Detect near-duplicate complaints within a 50m / 14-day window.',
        ],
    ];

    /**
     * Display metadata of the default workflow definition.
     *
     * @var array{code: string, old_name: string, new_name: string, description: string}
     */
    private const WORKFLOW_DEFINITION = [
        'code' => 'civic_default',
        'old_name' => 'Civic Report (default)',
        'new_name' => 'Civic Complaint (default)',
        'description' => 'Canonical lifecycle: draft → submitted → ai_processing → pending_moderator → assigned → accepted → in_progress → resolved_pending_verification → verified → closed. Supports citizen verification, reopening, supervisor escalation, and merge dispute.',
    ];

    /**
     * Lifecycle-state display-name updates (D6/D8): the seeded
     * "Closed"/"Draft" names leaked into emails, audit text and the
     * admin workflow editor. Only `name` changes — codes are stable
     * machine identifiers and every other status is untouched.
     *
     * @var array<string, array{old: string, new: string}>
     */
    private const STATUS_NAMES = [
        'closed' => [
            'old' => 'Closed',
            'new' => 'Resolved',
        ],
        'draft' => [
            'old' => 'Draft',
            'new' => 'Pending for Submission',
        ],
    ];

    public function up(): void
    {
        foreach (self::STATUS_NAMES as $code => $wording) {
            DB::table('report_statuses')->where('code', $code)->update([
                'name' => $wording['new'],
                'updated_at' => now(),
            ]);
        }

        foreach (self::TEMPLATES as $row) {
            $rows = DB::table('notification_templates')
                ->where('code', $row['code'])
                ->where('channel', $row['channel'])
                ->where('locale', 'en');

            if ((clone $rows)->where('version', '>=', 2)->exists()) {
                // A newer version already exists (e.g. a Super Admin
                // clone) — keep it exactly as-is.
                continue;
            }

            if (! (clone $rows)->where('version', 1)->exists()) {
                // Fresh install: the seeder creates v1 with the new
                // wording directly, so there is nothing to migrate.
                continue;
            }

            DB::table('notification_templates')->insert([
                'id' => (string) Str::uuid(),
                'code' => $row['code'],
                'name' => $row['name'],
                'channel' => $row['channel'],
                'subject' => $row['subject'],
                'body' => $row['body'],
                'variables' => json_encode($row['variables'], JSON_THROW_ON_ERROR),
                'locale' => 'en',
                'version' => 2,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            (clone $rows)->where('version', 1)->update([
                'active' => false,
                'updated_at' => now(),
            ]);
        }

        foreach (self::CONFIG_DESCRIPTIONS as $key => $wording) {
            DB::table('app_configs')->where('key', $key)->update([
                'description' => $wording['new'],
                'updated_at' => now(),
            ]);
        }

        $definition = DB::table('workflow_definitions')
            ->where('code', self::WORKFLOW_DEFINITION['code'])
            ->first();

        if ($definition !== null) {
            $definitionId = is_string($definition->id) ? $definition->id : '';

            DB::table('workflow_definitions')
                ->where('code', self::WORKFLOW_DEFINITION['code'])
                ->update([
                    'name' => self::WORKFLOW_DEFINITION['new_name'],
                    'description' => self::WORKFLOW_DEFINITION['description'],
                    'updated_at' => now(),
                ]);

            // Same two renames inside the default workflow's state
            // graph, keyed by the table's natural key
            // (workflow_definition_id, code). Scoped to civic_default
            // so Super Admin-created workflows are left alone.
            foreach (self::STATUS_NAMES as $code => $wording) {
                DB::table('workflow_states')
                    ->where('workflow_definition_id', $definitionId)
                    ->where('code', $code)
                    ->update([
                        'name' => $wording['new'],
                        'updated_at' => now(),
                    ]);
            }

            Cache::forget('workflow:def:code:'.self::WORKFLOW_DEFINITION['code']);
            Cache::forget("workflow:def:id:{$definitionId}");
        }
    }

    public function down(): void
    {
        $definition = DB::table('workflow_definitions')
            ->where('code', self::WORKFLOW_DEFINITION['code'])
            ->first();
        $definitionId = $definition !== null && is_string($definition->id) ? $definition->id : '';

        foreach (self::STATUS_NAMES as $code => $wording) {
            DB::table('report_statuses')
                ->where('code', $code)
                ->where('name', $wording['new'])
                ->update(['name' => $wording['old'], 'updated_at' => now()]);

            DB::table('workflow_states')
                ->where('workflow_definition_id', $definitionId)
                ->where('code', $code)
                ->where('name', $wording['new'])
                ->update(['name' => $wording['old'], 'updated_at' => now()]);
        }

        foreach (self::TEMPLATES as $row) {
            // Deactivate only the v2 rows this migration created
            // (matched on the seeded name, not admin clones).
            DB::table('notification_templates')
                ->where('code', $row['code'])
                ->where('channel', $row['channel'])
                ->where('locale', 'en')
                ->where('version', 2)
                ->where('name', $row['name'])
                ->update(['active' => false, 'updated_at' => now()]);

            DB::table('notification_templates')
                ->where('code', $row['code'])
                ->where('channel', $row['channel'])
                ->where('locale', 'en')
                ->where('version', 1)
                ->where('name', $this->v1Name($row['code'], $row['channel']))
                ->update(['active' => true, 'updated_at' => now()]);
        }

        foreach (self::CONFIG_DESCRIPTIONS as $key => $wording) {
            DB::table('app_configs')->where('key', $key)->update([
                'description' => $wording['old'],
                'updated_at' => now(),
            ]);
        }

        DB::table('workflow_definitions')
            ->where('code', self::WORKFLOW_DEFINITION['code'])
            ->update([
                'name' => self::WORKFLOW_DEFINITION['old_name'],
                'description' => self::WORKFLOW_DEFINITION['description'],
                'updated_at' => now(),
            ]);

        Cache::forget('workflow:def:code:'.self::WORKFLOW_DEFINITION['code']);
    }

    /**
     * The version-1 display name for a template code/channel.
     */
    private function v1Name(string $code, string $channel): string
    {
        return match ("{$code}|{$channel}") {
            'report.assigned|email' => 'Report Assigned',
            'report.assigned.sms|sms' => 'Report Assigned (SMS)',
            'report.status_changed|email' => 'Report Status Changed',
            'ai.classified|email' => 'AI Classified Your Report',
            'report.sla_breached|email' => 'Report SLA Breached',
            default => '',
        };
    }
};
