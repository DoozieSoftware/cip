<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * `notification_logs` row per docs/04 §13.
 *
 * Append-only delivery history. The class blocks
 * update() and delete() at runtime — the only way to
 * write a row is `create()`. The DB has no
 * `created_at` / `updated_at`, reinforcing the same
 * property at the storage layer; `attempted_at` is
 * the only timestamp.
 *
 * Use the accessor `providerResponse` for the decoded
 * provider payload.
 *
 * @property string $id
 * @property string $notification_id
 * @property string $channel
 * @property string $status
 * @property array|null $provider_response
 * @property int|null $latency_ms
 * @property Carbon $attempted_at
 */
class NotificationLog extends Model
{
    use HasFactory;
    use HasUuids;

    public $timestamps = false;

    protected $table = 'notification_logs';

    protected $fillable = [
        'notification_id', 'channel', 'status', 'provider_response',
        'latency_ms', 'attempted_at',
    ];

    protected $casts = [
        'provider_response' => 'array',
        'latency_ms' => 'integer',
        'attempted_at' => 'datetime',
    ];

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class, 'notification_id');
    }

    /**
     * Append-only: block updates.
     */
    protected function performUpdate(\Illuminate\Database\Eloquent\Builder $query)
    {
        throw new RuntimeException(
            'NotificationLog is append-only; create a new row instead of updating.'
        );
    }

    /**
     * Append-only: block deletes.
     */
    protected function performDeleteOnModel()
    {
        throw new RuntimeException(
            'NotificationLog is append-only; rows cannot be deleted.'
        );
    }
}
