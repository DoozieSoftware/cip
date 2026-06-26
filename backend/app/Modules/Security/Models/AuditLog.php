<?php

declare(strict_types=1);

namespace App\Modules\Security\Models;

use App\Modules\Security\Http\Middleware\AuditMiddleware;
use App\Modules\Shared\Exceptions\ModelImmutableException;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Audit log row.
 *
 * Append-only (per docs/04 §15 and docs/11 §28). The model blocks
 * update and delete at the Eloquent layer so the invariant is
 * enforced even if a future code path tries to mutate a row
 * directly. Inserts happen through {@see AuditMiddleware}
 * (request-scoped) and through the RoleService event listeners
 * (event-scoped).
 *
 * @property string $id
 * @property string|null $user_id
 * @property string $entity
 * @property string|null $entity_id
 * @property string $action
 * @property array<string, mixed>|null $before
 * @property array<string, mixed>|null $after
 * @property string|null $ip
 * @property string|null $device_fingerprint
 * @property string|null $request_id
 * @property Carbon $created_at
 */
class AuditLog extends Model
{
    use HasUuids;

    protected $table = 'audit_logs';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'entity',
        'entity_id',
        'action',
        'before',
        'after',
        'ip',
        'device_fingerprint',
        'request_id',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function save(array $options = [])
    {
        if ($this->exists) {
            throw ModelImmutableException::updateAttempted(static::class);
        }

        return parent::save($options);
    }

    public function delete(): ?bool
    {
        throw ModelImmutableException::deleteAttempted(static::class);
    }

    /**
     * @return BelongsTo<User, AuditLog>
     */
    public function user(): BelongsTo
    {
        /** @var BelongsTo<User, AuditLog> $relation */
        $relation = $this->belongsTo(User::class, 'user_id');

        return $relation;
    }
}
