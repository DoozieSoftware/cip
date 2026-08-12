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
use Illuminate\Support\Facades\Storage;

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
    protected $signature = 'settings:purge-retention {--dry-run : Report what would be deleted without deleting} {--approve : Explicitly approve destructive deletion}';

    protected $description = 'Delete records older than their configured retention window (retention.* settings).';

    /**
     * @var list<array{key: string, model: class-string<Model>, column: string, orphaned?: bool, append_only?: bool}>
     */
    private const TARGETS = [
        ['key' => 'retention.audit.days', 'model' => AuditLog::class, 'column' => 'created_at', 'append_only' => true],
        ['key' => 'retention.security_events.days', 'model' => SecurityEvent::class, 'column' => 'created_at'],
        ['key' => 'retention.notifications.days', 'model' => Notification::class, 'column' => 'created_at'],
        ['key' => 'retention.media.days', 'model' => Media::class, 'column' => 'created_at', 'orphaned' => true],
        ['key' => 'retention.ai_logs.days', 'model' => AiJob::class, 'column' => 'created_at'],
        ['key' => 'retention.ai_logs.days', 'model' => AiResult::class, 'column' => 'created_at'],
        ['key' => 'retention.ai_logs.days', 'model' => AiLabel::class, 'column' => 'created_at'],
    ];

    public function handle(SettingsService $settings): int
    {
        $dryRun = filter_var($this->option('dry-run'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === true;

        if (! $dryRun && ! $this->option('approve')) {
            $this->error('Destructive retention purge requires --approve; use --dry-run to preview.');

            return self::FAILURE;
        }
        $totalDeleted = 0;

        foreach (self::TARGETS as $target) {
            $daysSetting = $settings->get($target['key'], 0);
            $days = is_numeric($daysSetting) ? (int) $daysSetting : 0;

            if ($days <= 0) {
                $this->line("skip  {$target['key']} — not configured (retain forever)");

                continue;
            }

            if (($target['append_only'] ?? false) === true) {
                $this->line("skip  {$target['key']} — append-only audit records are never purged");

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

    /**
     * @param  array{key: string, model: class-string<Model>, column: string, orphaned?: bool, append_only?: bool}  $target
     */
    private function purge(array $target, int $days, bool $dryRun): int
    {
        try {
            $model = $target['model'];
            $column = $target['column'];

            /** @var Builder<Model> $query */
            $query = $model::query()->where($column, '<', now()->subDays($days));

            if (($target['orphaned'] ?? false) && method_exists($model, 'report')) {
                $query->whereNull('report_id');
            }

            $query->whereNotExists(function ($hold) use ($model): void {
                $hold->from('retention_holds')
                    ->whereColumn('retention_holds.entity_id', $model::query()->getModel()->getTable().'.id')
                    ->where('retention_holds.entity_type', $model)
                    ->whereNull('retention_holds.released_at')
                    ->where(function ($expiry): void {
                        $expiry->whereNull('retention_holds.expires_at')
                            ->orWhere('retention_holds.expires_at', '>=', now());
                    });
            });

            if ($dryRun) {
                return (int) $query->count();
            }

            $deleted = 0;
            $query->select(['id', ...($target['orphaned'] ?? false ? ['storage_disk', 'storage_path'] : [])])
                ->chunkById(200, function ($rows) use ($model, &$deleted): void {
                    foreach ($rows as $row) {
                        if ($model === Media::class && is_string($row->storage_disk) && is_string($row->storage_path)) {
                            try {
                                Storage::disk($row->storage_disk)->delete($row->storage_path);
                            } catch (\Throwable $e) {
                                $this->warn('storage delete failed for '.$row->id.': '.$e->getMessage());
                                continue;
                            }
                        }
                        $model::query()->whereKey($row->id)->delete();
                        $deleted++;
                    }
                });

            return $deleted;
        } catch (\Throwable $e) {
            $this->warn("error purging {$target['key']}: {$e->getMessage()}");

            return 0;
        }
    }
}
