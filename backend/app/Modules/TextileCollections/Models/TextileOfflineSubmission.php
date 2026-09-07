<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Media\Models\Media;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $collection_request_id
 * @property string $submitted_by
 * @property string|null $service_zone_id
 * @property string $idempotency_key
 * @property string $outcome
 * @property int|null $actual_bags
 * @property float|null $actual_weight_kg
 * @property string|null $reason
 * @property string|null $proof_media_id
 * @property string $status
 * @property string|null $error_code
 * @property string|null $error_message
 * @property int $retry_count
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class TextileOfflineSubmission extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    protected $table = 'textile_offline_submissions';

    /** @var list<string> */
    protected $fillable = [
        'collection_request_id',
        'submitted_by',
        'service_zone_id',
        'idempotency_key',
        'outcome',
        'actual_bags',
        'actual_weight_kg',
        'reason',
        'proof_media_id',
        'status',
        'error_code',
        'error_message',
        'retry_count',
        'completed_at',
    ];

    /** @return array<string,string> */
    protected function casts(): array
    {
        return [
            'actual_bags' => 'integer',
            'actual_weight_kg' => 'float',
            'retry_count' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<TextileCollectionRequest,$this> */
    public function collectionRequest(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionRequest::class, 'collection_request_id');
    }

    /** @return BelongsTo<User,$this> */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /** @return BelongsTo<Media,$this> */
    public function proofMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'proof_media_id');
    }

    /** @return BelongsTo<TextileServiceZone,$this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }
}
