<?php

declare(strict_types=1);

namespace App\Modules\Security\Models;

use App\Modules\Shared\Exceptions\ModelImmutableException;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Security event record.
 *
 * Append-only audit log (per docs/11 §29). The model blocks update and
 * delete at the Eloquent layer to enforce the invariant. Use the
 * `SecurityEventService` (T-M2-021) as the single entry point for new
 * events.
 *
 * Severity values: `info`, `warning`, `critical`. The event column holds
 * a short constant — `login.succeeded`, `token.reuse_detected`, etc.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string $event
 * @property string $severity
 * @property array<string, mixed>|null $metadata
 * @property string|null $ip
 * @property string|null $user_agent
 * @property Carbon $created_at
 */
class SecurityEvent extends Model
{
    use HasUuids;

    public const SEVERITY_INFO = 'info';

    public const SEVERITY_WARNING = 'warning';

    public const SEVERITY_CRITICAL = 'critical';

    public const ALLOWED_SEVERITIES = [
        self::SEVERITY_INFO,
        self::SEVERITY_WARNING,
        self::SEVERITY_CRITICAL,
    ];

    protected $table = 'security_events';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'event',
        'severity',
        'metadata',
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
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Security events are append-only. Any save() that is not a pure
     * INSERT raises ModelImmutableException.
     */
    public function save(array $options = [])
    {
        if ($this->exists) {
            throw ModelImmutableException::updateAttempted(static::class);
        }

        return parent::save($options);
    }

    /**
     * Security events are append-only. Deletes are never allowed.
     */
    public function delete(): ?bool
    {
        throw ModelImmutableException::deleteAttempted(static::class);
    }

    /**
     * @return BelongsTo<User, SecurityEvent>
     */
    public function user(): BelongsTo
    {
        /** @var BelongsTo<User, SecurityEvent> $relation */
        $relation = $this->belongsTo(User::class, 'user_id');

        return $relation;
    }
}
