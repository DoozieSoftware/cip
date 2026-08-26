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

    protected $table = 'textile_collection_batches';

    /** @var list<string> */
    protected $fillable = [
        'service_zone_id', 'reference', 'collection_date', 'window_start',
        'window_end', 'status', 'trip_reference', 'instructions', 'created_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['collection_date' => 'date'];
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
