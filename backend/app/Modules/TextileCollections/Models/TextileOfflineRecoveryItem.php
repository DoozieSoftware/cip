<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $collection_request_id
 * @property string $reported_by
 * @property string|null $idempotency_key
 * @property string|null $failure_reason
 * @property array<string, mixed>|null $payload_snapshot
 * @property string $status
 * @property Carbon|null $resolved_at
 * @property string|null $resolved_by
 */
final class TextileOfflineRecoveryItem extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_RESOLVED = 'resolved';

    protected $table = 'textile_offline_recovery_items';

    /** @var list<string> */
    protected $fillable = [
        'collection_request_id',
        'reported_by',
        'idempotency_key',
        'failure_reason',
        'payload_snapshot',
        'status',
        'resolved_at',
        'resolved_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload_snapshot' => 'array',
            'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<TextileCollectionRequest, $this> */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionRequest::class, 'collection_request_id');
    }
}
