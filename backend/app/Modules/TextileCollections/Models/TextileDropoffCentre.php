<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A physical drop-off centre inside a service zone (issue #11).
 *
 * Zones hold many centres; citizens pick one when booking a drop-off.
 * The legacy single-centre columns on TextileServiceZone
 * (dropoff_name/dropoff_address) are retained for back-compat only —
 * new staff tooling reads and writes this table.
 *
 * @property string $id
 * @property string $service_zone_id
 * @property string $name
 * @property string|null $address
 * @property float|null $latitude
 * @property float|null $longitude
 * @property array<string, mixed>|null $operating_hours
 * @property string|null $public_phone
 * @property string $status
 * @property string|null $closed_note
 * @property bool $active
 * @property int $sort_order
 * @property-read TextileServiceZone $serviceZone
 */
final class TextileDropoffCentre extends Model
{
    use HasUuids;

    public const STATUS_OPEN = 'open';

    public const STATUS_TEMPORARILY_CLOSED = 'temporarily_closed';

    /** @var list<string> */
    public const VALID_STATUSES = [self::STATUS_OPEN, self::STATUS_TEMPORARILY_CLOSED];

    protected $table = 'textile_dropoff_centres';

    /** @var list<string> */
    protected $fillable = [
        'service_zone_id', 'name', 'address', 'latitude', 'longitude', 'operating_hours',
        'public_phone', 'status', 'closed_note', 'active', 'sort_order',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'operating_hours' => 'array',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }

    /** @return HasMany<TextileCollectionRequest, $this> */
    public function requests(): HasMany
    {
        return $this->hasMany(TextileCollectionRequest::class, 'dropoff_centre_id');
    }
}
