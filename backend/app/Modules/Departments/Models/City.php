<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\CityFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * City master. Part of the Location Domain per docs/04 §8.
 *
 * @property string $id
 * @property string $district_id
 * @property string $name
 * @property string $code
 * @property bool $active
 */
class City extends Model
{
    /**
     * @use HasFactory<CityFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'cities';

    /**
     * @var list<string>
     */
    protected $fillable = ['district_id', 'name', 'code', 'active'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /**
     * @return BelongsTo<District, $this>
     */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class, 'district_id');
    }

    /**
     * @return HasMany<Zone, $this>
     */
    public function zones(): HasMany
    {
        return $this->hasMany(Zone::class, 'zone_id');
    }
}
