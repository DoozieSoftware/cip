<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * `notifications` row per docs/04 §13.
 *
 * Represents a single (user, event) delivery candidate.
 * The dispatcher (T-M9-012) creates the row, the
 * SendNotificationJob (T-M9-013) marks it `sent` or
 * `failed`, and the citizen inbox reads it back via the
 * /api/v1/notifications endpoint (T-M9-015).
 *
 * Status state machine:
 *   pending  → sent      (success)
 *   pending  → failed    (transient error, will retry)
 *   failed   → dead      (max retries exhausted; quarantined)
 *
 * @property string $id
 * @property string $user_id
 * @property string $type
 * @property string $channel
 * @property array $payload
 * @property string $status
 * @property Carbon|null $read_at
 * @property Carbon|null $scheduled_at
 * @property int $retry_count
 * @property string|null $last_error
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Notification extends Model
{
    use HasFactory;
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public const STATUS_DEAD = 'dead';

    public const CHANNEL_PUSH = 'push';

    public const CHANNEL_EMAIL = 'email';

    public const CHANNEL_SMS = 'sms';

    public const CHANNEL_WEBHOOK = 'webhook';

    protected $table = 'notifications';

    protected $fillable = [
        'user_id', 'type', 'channel', 'payload', 'status',
        'read_at', 'scheduled_at', 'retry_count', 'last_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'read_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'retry_count' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(NotificationLog::class, 'notification_id');
    }
}
