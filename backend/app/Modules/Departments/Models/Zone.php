<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\ZoneFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Zone master. Part of the Location Domain per docs/04 §8.
 *
 * @property string $id
 * @property string $city_id
 * @property string $name
 * @property string $code
 * @property bool $active
 */
class Zone extends Model
{
    /**
     * @use HasFactory<ZoneFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'zones';

    /**
     * @var list<string>
     */
    protected $fillable = ['city_id', 'name', 'code', 'active'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /**
     * @return BelongsTo<City, $this>
     */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }
}
