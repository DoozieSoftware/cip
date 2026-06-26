<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * OTP record.
 *
 * Mirrors the otps table introduced in T-M2-004. The model is intentionally
 * kept immutable: no `updated_at`, no `deleted_at`, no save() paths in this
 * milestone. `consumed_at` is set by the auth flow (T-M2-014) when the
 * citizen verifies the code.
 *
 * Per docs/04 §6 and docs/11 §6 (citizen OTP only) and §21 (5 OTPs/hour).
 *
 * @property string $id
 * @property string $mobile
 * @property string $code_hash
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property int $attempts
 * @property string|null $ip
 * @property string|null $user_agent
 * @property Carbon $created_at
 */
class Otp extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'otps';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'mobile',
        'code_hash',
        'expires_at',
        'consumed_at',
        'attempts',
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
            'consumed_at' => 'datetime',
            'attempts' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Has the OTP passed its expiry window? An OTP whose expires_at is
     * strictly in the past is expired; the auth flow must issue a new one.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Has the OTP already been consumed? A consumed OTP cannot be
     * re-verified — the auth flow must mark consumed_at on first use.
     */
    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }

    /**
     * Is the OTP still usable? Usable = not expired AND not consumed AND
     * attempts < 5. Used by the auth flow as the primary guard before
     * calling password_verify on the code.
     */
    public function isUsable(): bool
    {
        if ($this->isExpired() || $this->isConsumed()) {
            return false;
        }

        return $this->attempts < 5;
    }

    /**
     * Persist an attempt counter increment. Returns the new attempt count.
     * The auth flow calls this BEFORE the code-hash check so that even an
     * incorrect code consumes a slot.
     */
    public function incrementAttempts(): int
    {
        $this->attempts = ((int) $this->attempts) + 1;
        $this->save();

        return $this->attempts;
    }

    /**
     * Mark the OTP as consumed (used). The auth flow calls this on the
     * happy path after a successful code-hash match.
     */
    public function markConsumed(): void
    {
        $this->consumed_at = now();
        $this->save();
    }

    /**
     * Scope: latest un-consumed OTP for the given mobile. Used by the
     * auth flow's rate-limit guard and by the verify-otp handler.
     *
     * @param  Builder<Otp>  $query
     * @return Builder<Otp>
     */
    public function scopeLatestFor(Builder $query, string $mobile): Builder
    {
        return $query->where('mobile', $mobile)
            ->orderByDesc('created_at');
    }
}
