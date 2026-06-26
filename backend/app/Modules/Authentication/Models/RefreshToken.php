<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Refresh token record.
 *
 * Mirrors the refresh_tokens table introduced in T-M2-006. Tokens are
 * immutable: no updated_at, no deleted_at. Rotation is implemented by
 * setting the parent's `revoked_at` and inserting a child row that
 * points at the parent via `parent_id`. See `RefreshTokenService`
 * (T-M2-007) for the rotation flow.
 *
 * Per docs/11 §7 (Refresh Token Rotation).
 *
 * @property string $id
 * @property string $user_id
 * @property string $token_hash
 * @property string|null $parent_id
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property string|null $ip
 * @property string|null $user_agent
 * @property Carbon $created_at
 */
class RefreshToken extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'refresh_tokens';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'token_hash',
        'parent_id',
        'expires_at',
        'revoked_at',
        'ip',
        'user_agent',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Owner of the token.
     *
     * @return BelongsTo<User, RefreshToken>
     */
    public function user(): BelongsTo
    {
        /** @var BelongsTo<User, RefreshToken> $relation */
        $relation = $this->belongsTo(User::class, 'user_id');

        return $relation;
    }

    /**
     * Parent token in the rotation chain (nullable for the first issue).
     *
     * @return BelongsTo<RefreshToken, RefreshToken>
     */
    public function parent(): BelongsTo
    {
        /** @var BelongsTo<RefreshToken, RefreshToken> $relation */
        $relation = $this->belongsTo(self::class, 'parent_id');

        return $relation;
    }

    /**
     * Has the token been revoked? A revoked token cannot be rotated.
     */
    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    /**
     * Has the token passed its expiry window? An expired token cannot be
     * rotated — the auth flow must issue a new login.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Is the token still usable? Usable = not revoked AND not expired.
     */
    public function isUsable(): bool
    {
        return ! $this->isRevoked() && ! $this->isExpired();
    }

    /**
     * Mark the token as revoked. Used by the rotation service and the
     * logout endpoint.
     */
    public function markRevoked(): void
    {
        $this->revoked_at = now();
        $this->save();
    }

    /**
     * Scope: active (not-revoked, not-expired) tokens for a user.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at')
            ->where('expires_at', '>', now());
    }
}
