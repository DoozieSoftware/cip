<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string|null $report_id
 * @property string $citizen_id
 * @property string $reference
 * @property string $title
 * @property string|null $notes
 * @property string|null $category
 * @property string $service_zone_id
 * @property string|null $department_id
 * @property string|null $batch_id
 * @property string $requester_type
 * @property string $requester_name
 * @property string|null $rwa_name
 * @property string $contact_email
 * @property string $contact_phone
 * @property string $pickup_address
 * @property float|null $latitude
 * @property float|null $longitude
 * @property string $collection_method
 * @property int $estimated_bags
 * @property float $estimated_weight_kg
 * @property string $status
 * @property Carbon|null $scheduled_date
 * @property string|null $scheduled_window_start
 * @property string|null $scheduled_window_end
 * @property string|null $readiness_instructions
 * @property int|null $actual_bags
 * @property float|null $actual_weight_kg
 * @property string|null $rejection_reason
 * @property string|null $missed_pickup_reason
 * @property Carbon|null $picked_up_at
 * @property Carbon|null $submitted_at
 * @property Carbon|null $capacity_checked_at
 * @property-read Report|null $report
 * @property-read User|null $citizen
 * @property-read TextileServiceZone|null $serviceZone
 * @property-read TextileCollectionBatch|null $batch
 * @property-read Department|null $department
 */
final class TextileCollectionRequest extends Model
{
    use HasUuids;

    public const STATUS_PENDING_REVIEW = 'pending_review';

    public const STATUS_READY_TO_GROUP = 'ready_to_group';

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_PICKED_UP = 'picked_up';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_MISSED = 'missed';

    public const STATUS_DROPOFF_AWAITING_DROP = 'dropoff_awaiting_drop';

    public const STATUS_RECEIVED_AT_CENTRE = 'received_at_centre';

    // TODO D-01/D-02: extra end states dropoff_expired / no_show pending decision.

    /** @var list<string> */
    public const VALID_CATEGORIES = ['clothes_waste', 'metal_scrap', 'e_waste'];

    protected $table = 'textile_collection_requests';

    /** @var list<string> */
    protected $fillable = [
        'dropoff_confirmed_at', 'dropoff_valid_from', 'dropoff_valid_until', 'receipt_id', 'capacity_exception_id', 'capacity_checked_at', 'capacity_context', 'stop_order', 'outcome_idempotency_key', 'offline_queued_at',
        'report_id', 'citizen_id', 'reference', 'title', 'notes',
        'category', 'service_zone_id', 'department_id', 'batch_id', 'requester_type',
        'requester_name', 'rwa_name', 'contact_email', 'contact_phone',
        'pickup_address', 'latitude', 'longitude', 'collection_method', 'estimated_bags',
        'estimated_weight_kg', 'status', 'scheduled_date',
        'scheduled_window_start', 'scheduled_window_end', 'readiness_instructions',
        'actual_bags', 'actual_weight_kg', 'rejection_reason',
        'cancellation_reason', 'missed_pickup_reason', 'picked_up_at', 'submitted_at',
        'rescheduled_at', 'reminder_sent_at', 'reschedule_count',
        'previous_scheduled_date', 'previous_window_start', 'previous_window_end', 'previous_batch_id',
    ]; // TODO D-05/D-06 OPEN: cutoff window + reminder timing pending partner decision.

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'estimated_bags' => 'integer',
            'estimated_weight_kg' => 'float',
            'actual_bags' => 'integer',
            'actual_weight_kg' => 'float',
            'reschedule_count' => 'integer',
            'dropoff_confirmed_at' => 'datetime',
            'dropoff_valid_from' => 'date',
            'dropoff_valid_until' => 'date',
            'latitude' => 'float',
            'longitude' => 'float',
            'scheduled_date' => 'date',
            'previous_scheduled_date' => 'date',
            'picked_up_at' => 'datetime',
            'submitted_at' => 'datetime',
            'rescheduled_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'offline_queued_at' => 'datetime',
            'capacity_checked_at' => 'datetime',
            'capacity_context' => 'array',
        ];
    }

    protected static function booted(): void
    {
        self::creating(function (TextileCollectionRequest $request): void {
            if (! is_string($request->reference) || $request->reference === '') {
                $request->reference = 'DLN-'.now()->format('Y').'-'.strtoupper(substr(str_replace('-', '', (string) $request->newUniqueId()), -8));
            }
        });
    }

    /** @return BelongsTo<User, $this> */
    public function citizen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'citizen_id');
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }

    /** @return BelongsTo<TextileCollectionBatch, $this> */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionBatch::class, 'batch_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return HasMany<Media, $this> */
    public function photos(): HasMany
    {
        return $this->hasMany(Media::class, 'textile_collection_id');
    }
}
