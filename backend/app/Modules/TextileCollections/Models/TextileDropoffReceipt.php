<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property Carbon $received_at
 */
final class TextileDropoffReceipt extends Model
{
    use HasUuids;

    protected $table = 'textile_dropoff_receipts';

    /** @var list<string> */
    protected $fillable = [
        'collection_request_id', 'received_by', 'service_zone_id', 'received_at',
        'actual_bags', 'actual_weight_kg', 'proof_media_id', 'exception_code',
        'exception_reason', 'idempotency_key',
    ];

    /** @return array<string,string> */
    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'actual_bags' => 'integer',
            'actual_weight_kg' => 'float',
        ];
    }

    /** @return BelongsTo<TextileCollectionRequest,$this> */
    public function request(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionRequest::class, 'collection_request_id');
    }

    /** @return BelongsTo<User,$this> */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
