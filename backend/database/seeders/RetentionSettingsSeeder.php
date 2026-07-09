<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Settings\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds the default `retention.*` settings the Super Admin configures
 * on the Data Retention page (docs/09 §25).
 *
 * These drive the scheduled `settings:purge-retention` command
 * (bug #5). A missing key means "retain forever" — the command skips
 * any target whose value is absent or zero — so seeding sensible
 * defaults here is safe and never triggers mass deletion.
 *
 * `retention.purge_enabled` is the master kill-switch for the
 * scheduler (default off); operators opt in explicitly.
 *
 * Idempotent: `updateOrCreate` on `key`.
 */
class RetentionSettingsSeeder extends Seeder
{
    /**
     * @var list<array{key: string, value: int, type: string, description: string}>
     */
    private const DEFAULTS = [
        [
            'key' => 'retention.purge_enabled',
            'value' => 0,
            'type' => 'int',
            'description' => 'Master switch for the scheduled retention purge (settings:purge-retention). Default off — operators opt in explicitly.',
        ],
        [
            'key' => 'retention.media.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days to retain orphaned media before purge (0 = retain forever).',
        ],
        [
            'key' => 'retention.audit.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days to retain audit log rows before purge (0 = retain forever).',
        ],
        [
            'key' => 'retention.audit_export.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days audit export archives are retained (0 = retain forever).',
        ],
        [
            'key' => 'retention.notifications.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days to retain notification logs before purge (0 = retain forever).',
        ],
        [
            'key' => 'retention.soft_deleted.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days before soft-deleted records are hard-purged (0 = retain forever).',
        ],
        [
            'key' => 'retention.backup.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days backup snapshots are retained (informational — backups are managed separately).',
        ],
        [
            'key' => 'retention.anonymized_reports.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days before anonymized report copies are purged (0 = retain forever). Not yet enforced — no purge target reads this key.',
        ],
        [
            'key' => 'retention.security_events.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days to retain security event rows before purge (0 = retain forever).',
        ],
        [
            'key' => 'retention.ai_logs.days',
            'value' => 0,
            'type' => 'int',
            'description' => 'Days to retain AI job/result/label rows before purge (0 = retain forever).',
        ],
    ];

    public function run(): void
    {
        foreach (self::DEFAULTS as $row) {
            Setting::query()->updateOrCreate(
                ['key' => $row['key']],
                ['value' => $row['value'], 'type' => $row['type'], 'description' => $row['description'], 'is_public' => false],
            );
        }
    }
}
