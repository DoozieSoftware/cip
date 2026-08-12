<?php

declare(strict_types=1);

namespace App\Modules\Settings\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A legal/operational hold that prevents retention deletion of one entity.
 *
 * @property string $id
 * @property string $entity_type
 * @property string $entity_id
 * @property string $reason
 * @property string|null $held_by
 * @property Carbon|null $expires_at
 * @property Carbon|null $released_at
 * @property string|null $released_by
 * @property string|null $release_reason
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class RetentionHold extends Model
{
    use HasUuids;

    protected $table = 'retention_holds';

    /** @var list<string> */
    protected $fillable = [
        'entity_type', 'entity_id', 'reason', 'held_by', 'expires_at', 'released_at',
        'released_by', 'release_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function holder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'held_by');
    }

    /** @return BelongsTo<User, $this> */
    public function releaser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function isActive(?Carbon $at = null): bool
    {
        $at ??= now();
        $attributes = $this->getAttributes();
        $releasedAt = $this->getRawOriginal('released_at') ?? ($attributes['released_at'] ?? null);
        $expiresAt = $this->getRawOriginal('expires_at') ?? ($attributes['expires_at'] ?? null);

        if ($releasedAt !== null) {
            return false;
        }

        if ($expiresAt === null) {
            return true;
        }

        if (! is_string($expiresAt)) {
            return false;
        }

        $expiresAt = Carbon::parse($expiresAt);

        return $expiresAt->greaterThanOrEqualTo($at);
    }
}
