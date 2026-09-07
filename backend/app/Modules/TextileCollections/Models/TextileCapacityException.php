<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $collection_request_id
 * @property string|null $service_zone_id
 * @property string $department_id
 * @property string $requested_by
 * @property string $status
 * @property string|null $reason_code
 * @property string|null $reason
 */
final class TextileCapacityException extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const REASON_BELOW_MINIMUM = 'below_minimum';

    public const REASON_HIGH_VALUE = 'high_value';

    public const REASON_URGENT = 'urgent';

    public const REASON_VEHICLE_MISMATCH = 'vehicle_mismatch';

    public const REASON_CAPACITY_OVERRIDE = 'capacity_override';

    /** @var list<string> */
    public const VALID_REASON_CODES = [
        self::REASON_BELOW_MINIMUM,
        self::REASON_HIGH_VALUE,
        self::REASON_URGENT,
        self::REASON_VEHICLE_MISMATCH,
        self::REASON_CAPACITY_OVERRIDE,
    ];

    protected $table = 'textile_capacity_exceptions';

    /** @var list<string> */
    protected $fillable = [
        'collection_request_id',
        'service_zone_id',
        'department_id',
        'requested_by',
        'status',
        'reason_code',
        'reason',
        'payload_snapshot',
        'decision_payload',
        'decided_by',
        'decided_reason',
        'decided_at',
        'idempotency_key',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload_snapshot' => 'array',
            'decision_payload' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<TextileCollectionRequest, $this> */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionRequest::class, 'collection_request_id');
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
