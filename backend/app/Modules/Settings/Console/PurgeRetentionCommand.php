<?php

declare(strict_types=1);

namespace App\Modules\Settings\Console;

use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\Media\Models\Media;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Settings\Services\SettingsService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Purge records that have aged past their configured retention window.
 *
 * Each target table is governed by a `retention.<entity>.days` setting
 * read via SettingsService. A missing or zero/negative value means
 * "retain forever" — the table is skipped so the command never
 * mass-deletes when unconfigured. Media are only purged when they are
 * orphaned (no parent report), to avoid destroying evidence still
 * attached to a live report.
 *
 * `--dry-run` reports the row counts that would be deleted without
 * touching the database.
 */
class PurgeRetentionCommand extends Command
{
    protected $signature = 'settings:purge-retention {--dry-run : Report what would be deleted without deleting}';

    protected $description = 'Delete records older than their configured retention window (retention.* settings).';

    /**
     * @var list<array{key: string, model: class-string<Model>, column: string, orphaned?: bool}>
     */
    private const TARGETS = [
        ['key' => 'retention.audit.days', 'model' => AuditLog::class, 'column' => 'created_at'],
        ['key' => 'retention.security_events.days', 'model' => SecurityEvent::class, 'column' => 'created_at'],
        ['key' => 'retention.notifications.days', 'model' => Notification::class, 'column' => 'created_at'],
        ['key' => 'retention.media.days', 'model' => Media::class, 'column' => 'created_at', 'orphaned' => true],
        ['key' => 'retention.ai_logs.days', 'model' => AiJob::class, 'column' => 'created_at'],
        ['key' => 'retention.ai_logs.days', 'model' => AiResult::class, 'column' => 'created_at'],
        ['key' => 'retention.ai_logs.days', 'model' => AiLabel::class, 'column' => 'created_at'],
    ];

    public function handle(SettingsService $settings): int
    {
        $dryRun = $this->option('dry-run');
        $totalDeleted = 0;

        foreach (self::TARGETS as $target) {
            $days = (int) $settings->get($target['key'], 0);

            if ($days <= 0) {
                $this->line("skip  {$target['key']} — not configured (retain forever)");

                continue;
            }

            $deleted = $this->purge($target, $days, $dryRun);
            $totalDeleted += $deleted;

            $verb = $dryRun ? 'would delete' : 'deleted';
            $this->info("{$verb} {$deleted} row(s) from {$target['key']} (>{$days}d)");
        }

        if ($dryRun) {
            $this->line("dry-run complete — {$totalDeleted} row(s) would have been deleted");
        } else {
            $this->info("purge complete — {$totalDeleted} row(s) deleted total");
        }

        return self::SUCCESS;
    }

    private function purge(array $target, int $days, bool $dryRun): int
    {
        try {
            /** @var Builder $query */
            $query = ($target['model'])::query()->where($target['column'], '<', now()->subDays($days));

            if (($target['orphaned'] ?? false) && method_exists($target['model'], 'report')) {
                $query->whereNull('report_id');
            }

            $ids = (clone $query)->pluck('id');

            if ($ids->isEmpty()) {
                return 0;
            }

            if ($dryRun) {
                return $ids->count();
            }

            ($target['model'])::query()->whereIn('id', $ids)->delete();

            return $ids->count();
        } catch (\Throwable $e) {
            $this->warn("error purging {$target['key']}: {$e->getMessage()}");

            return 0;
        }
    }
}
