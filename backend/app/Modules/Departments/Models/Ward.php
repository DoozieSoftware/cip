<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\WardFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Ward master. Smallest geography unit in the platform.
 * Per docs/04 §8 wards are the only level that carries a
 * boundary polygon, and the only one that uses SoftDeletes
 * (boundary updates leave a tombstone for audit).
 *
 *  - UUID primary key (HasUuids)
 *  - belongs to a City (required) and a Zone (optional)
 *  - soft deletes
 *  - boundary_polygon is stored as WKT (well-known text) — the
 *    MySQL POLYGON + spatial index is created in the migration
 *    and the application layer never sees the raw binary form.
 *
 * @property string $id
 * @property string $city_id
 * @property string|null $zone_id
 * @property int $ward_number
 * @property string $name
 * @property string|null $municipality
 * @property bool $active
 * @property string|null $boundary_polygon
 */
class Ward extends Model
{
    /**
     * @use HasFactory<WardFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'wards';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'city_id',
        'zone_id',
        'ward_number',
        'name',
        'municipality',
        'active',
        'boundary_polygon',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'ward_number' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<City, $this>
     */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }

    /**
     * @return BelongsTo<Zone, $this>
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'zone_id');
    }
}
