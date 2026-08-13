<?php

declare(strict_types=1);

namespace App\Modules\Settings\Services;

use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiLabel;
use App\Modules\AI\Models\AiResult;
use App\Modules\Media\Models\Media;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Security\Models\SecurityEvent;
use App\Modules\Settings\Models\RetentionHold;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Legal hold lifecycle and target policy.
 *
 * Holds are deliberately constrained to entities governed by the retention
 * purge command. Callers use stable, non-implementation aliases while the
 * database stores class names for the purge query. All lifecycle changes are
 * made through this service so duplicate holds and release races are handled
 * consistently.
 */
final class RetentionHoldService
{
    /**
     * @var array<string, class-string<Model>>
     */
    private const ENTITY_TYPES = [
        'media' => Media::class,
        'security_event' => SecurityEvent::class,
        'notification' => Notification::class,
        'ai_job' => AiJob::class,
        'ai_result' => AiResult::class,
        'ai_label' => AiLabel::class,
    ];

    /**
     * @return list<string>
     */
    public static function supportedEntityTypes(): array
    {
        return array_keys(self::ENTITY_TYPES);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, RetentionHold>
     */
    public function paginate(array $filters, int $perPage = 50): LengthAwarePaginator
    {
        $perPage = max(1, min(100, $perPage));

        return $this->buildQuery($filters)->paginate($perPage);
    }

    /**
     * Stream a bounded-memory CSV custody export for legal/audit review.
     * The export contains metadata only; evidence bytes are never copied.
     *
     * @param  array<string, mixed>  $filters
     */
    public function export(array $filters): StreamedResponse
    {
        $filename = 'retention-holds-'.now()->format('Ymd-His').'.csv';
        $query = $this->buildQuery($filters);

        return response()->streamDownload(function () use ($query): void {
            $output = fopen('php://output', 'wb');

            if ($output === false) {
                return;
            }

            fputcsv($output, [
                'hold_id', 'entity_type', 'entity_id', 'reason', 'held_by', 'held_at',
                'expires_at', 'released_by', 'released_at', 'release_reason', 'active',
            ]);

            $query->chunkById(500, function ($holds) use ($output): void {
                foreach ($holds as $hold) {
                    if (! $hold instanceof RetentionHold) {
                        continue;
                    }

                    fputcsv($output, [
                        $hold->id,
                        $this->entityAlias((string) $hold->entity_type),
                        $hold->entity_id,
                        $this->csvCell($hold->reason),
                        $hold->held_by,
                        $hold->created_at->toIso8601String(),
                        $hold->expires_at?->toIso8601String(),
                        $hold->released_by,
                        $hold->released_at?->toIso8601String(),
                        $this->csvCell($hold->release_reason),
                        $hold->isActive() ? 'true' : 'false',
                    ]);
                }
            });

            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @param  array{entity_type: string, entity_id: string, reason: string, expires_at?: string|null}  $attributes
     */
    public function create(User $actor, array $attributes): RetentionHold
    {
        $entityType = $this->resolveEntityClass($attributes['entity_type']);
        $entityId = $attributes['entity_id'];
        $reason = trim($attributes['reason']);
        $expiresAt = $this->parseExpiry($attributes['expires_at'] ?? null);

        if ($reason === '') {
            throw ApiException::validation('A legal basis is required for a retention hold.', ['reason' => ['The reason field is required.']]);
        }

        return DB::transaction(function () use ($actor, $entityType, $entityId, $reason, $expiresAt): RetentionHold {
            $this->assertTargetExists($entityType, $entityId);

            $alreadyHeld = RetentionHold::query()
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->whereNull('released_at')
                ->where(function (Builder $expiryQuery): void {
                    $expiryQuery->whereNull('expires_at')->orWhere('expires_at', '>=', now());
                })
                ->lockForUpdate()
                ->exists();

            if ($alreadyHeld) {
                throw ApiException::conflict('An active retention hold already exists for this entity.', 'RETENTION_HOLD_EXISTS');
            }

            $hold = new RetentionHold;
            $hold->entity_type = $entityType;
            $hold->entity_id = $entityId;
            $hold->reason = $reason;
            $hold->held_by = $this->userKey($actor);
            $hold->expires_at = $expiresAt;
            $hold->save();

            return $hold->load(['holder:id,name,mobile', 'releaser:id,name,mobile']);
        });
    }

    public function release(User $actor, RetentionHold $hold, string $reason): RetentionHold
    {
        $reason = trim($reason);

        if ($reason === '') {
            throw ApiException::validation('A release reason is required.', ['release_reason' => ['The release reason field is required.']]);
        }

        return DB::transaction(function () use ($actor, $hold, $reason): RetentionHold {
            $locked = RetentionHold::query()->lockForUpdate()->find($hold->getKey());

            if (! $locked instanceof RetentionHold) {
                throw ApiException::notFound('Retention hold');
            }

            if ($locked->released_at !== null) {
                throw ApiException::conflict('This retention hold has already been released.', 'RETENTION_HOLD_RELEASED');
            }

            $locked->released_at = now();
            $locked->released_by = $this->userKey($actor);
            $locked->release_reason = $reason;
            $locked->save();

            return $locked->load(['holder:id,name,mobile', 'releaser:id,name,mobile']);
        });
    }

    public function entityAlias(string $entityType): string
    {
        $alias = array_search($entityType, self::ENTITY_TYPES, true);

        return is_string($alias) ? $alias : $entityType;
    }

    /**
     * @return class-string<Model>
     */
    private function resolveEntityClass(string $entityType): string
    {
        $class = self::ENTITY_TYPES[$entityType] ?? null;

        if ($class === null) {
            throw ApiException::validation('Unsupported retention hold entity type.', [
                'entity_type' => ['Supported values: '.implode(', ', self::supportedEntityTypes()).'.'],
            ]);
        }

        return $class;
    }

    /** @param class-string<Model> $entityType */
    private function assertTargetExists(string $entityType, string $entityId): void
    {
        $model = new $entityType;
        $query = method_exists($model, 'trashed')
            ? $model->newQueryWithoutScopes()
            : $model->newQuery();

        if (! $query->whereKey($entityId)->exists()) {
            throw ApiException::notFound('Retention hold target');
        }
    }

    private function parseExpiry(?string $expiresAt): ?Carbon
    {
        if ($expiresAt === null || trim($expiresAt) === '') {
            return null;
        }

        try {
            $expiry = Carbon::parse($expiresAt);
        } catch (\Throwable) {
            throw ApiException::validation('The expiry timestamp is invalid.', ['expires_at' => ['Use an ISO-8601 date/time.']]);
        }

        if (! $expiry->isFuture()) {
            throw ApiException::validation('The expiry timestamp must be in the future.', ['expires_at' => ['The expiry timestamp must be in the future.']]);
        }

        return $expiry;
    }

    private function userKey(User $user): string
    {
        $key = $user->getKey();

        if (! is_string($key) && ! is_int($key)) {
            throw ApiException::serverError('The acting user has no valid identifier.');
        }

        return (string) $key;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<RetentionHold>
     */
    private function buildQuery(array $filters): Builder
    {
        $query = RetentionHold::query()
            ->with(['holder:id,name,mobile', 'releaser:id,name,mobile'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (isset($filters['entity_type']) && is_string($filters['entity_type']) && $filters['entity_type'] !== '') {
            $query->where('entity_type', $this->resolveEntityClass($filters['entity_type']));
        }

        if (isset($filters['entity_id']) && is_string($filters['entity_id']) && $filters['entity_id'] !== '') {
            $query->where('entity_id', $filters['entity_id']);
        }

        if (array_key_exists('active', $filters) && is_bool($filters['active'])) {
            $now = now();
            $query->where(function (Builder $activeQuery) use ($filters, $now): void {
                if ($filters['active'] === true) {
                    $activeQuery
                        ->whereNull('released_at')
                        ->where(function (Builder $expiryQuery) use ($now): void {
                            $expiryQuery->whereNull('expires_at')->orWhere('expires_at', '>=', $now);
                        });

                    return;
                }

                $activeQuery
                    ->whereNotNull('released_at')
                    ->orWhere(function (Builder $expiryQuery) use ($now): void {
                        $expiryQuery->whereNull('released_at')->where('expires_at', '<', $now);
                    });
            });
        }

        return $query;
    }

    private function csvCell(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }

        return in_array($value[0], ['=', '+', '-', '@'], true) ? "\t{$value}" : $value;
    }
}
