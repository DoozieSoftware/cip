<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $service_zone_id
 * @property Carbon $unavailable_date
 * @property string|null $window_start
 * @property string|null $window_end
 * @property string|null $reason
 * @property string|null $created_by
 */
final class TextileZoneUnavailability extends Model
{
    use HasUuids;

    protected $table = 'textile_zone_unavailabilities';

    /** @var list<string> */
    protected $fillable = [
        'service_zone_id', 'unavailable_date', 'window_start', 'window_end', 'reason', 'created_by',
    ];

    /** @return array<string,string> */
    protected function casts(): array
    {
        return [
            'unavailable_date' => 'date',
        ];
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }
}
