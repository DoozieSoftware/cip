<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $reference
 * @property Carbon $collection_date
 * @property string|null $window_start
 * @property string|null $window_end
 * @property string $status
 * @property string|null $trip_reference
 */
final class TextileCollectionBatch extends Model
{
    use HasUuids;

    public const STATUS_PLANNED = 'planned';

    public const STATUS_ASSIGNED = 'assigned';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';
    // TODO D-04: stop-level en_route/visited pending decision.

    protected $table = 'textile_collection_batches';

    /** @var list<string> */
    protected $fillable = [
        'service_zone_id', 'reference', 'collection_date', 'window_start',
        'window_end', 'status', 'trip_reference', 'instructions', 'created_by',
        'assigned_team_id', 'assigned_user_id', 'vehicle_label', 'assignment_reason',
        'assigned_by', 'assigned_at', 'started_at', 'completed_at', 'row_version',
        'reminder_sent_at', 'on_the_way_sent_at',
    ]; // TODO D-06 OPEN: reminder channel/timing per partner pending decision.

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'collection_date' => 'date',
            'assigned_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'on_the_way_sent_at' => 'datetime',
            'row_version' => 'integer',
        ];
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<TextileCollectionRequest, $this> */
    public function requests(): HasMany
    {
        return $this->hasMany(TextileCollectionRequest::class, 'batch_id');
    }
}
