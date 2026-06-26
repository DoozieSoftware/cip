<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use Database\Factories\Modules\Reports\Models\LocationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * `locations` row per docs/04 §8 and §24.
 *
 * The application always reads/writes `latitude` and `longitude`
 * as decimals. The `geom` POINT column is a MySQL-only spatial
 * index mirror, populated via raw SQL on write; the model does
 * not expose it.
 *
 * @property string $id
 * @property float $latitude
 * @property float $longitude
 * @property float|null $altitude
 * @property float|null $accuracy
 * @property float|null $heading
 * @property float|null $speed
 * @property string|null $gps_provider
 * @property \Illuminate\Support\Carbon|null $captured_at
 * @property string|null $address
 * @property string|null $ward_id
 * @property string|null $district_id
 */
class Location extends Model
{
    /**
     * @use HasFactory<LocationFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'locations';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'latitude',
        'longitude',
        'altitude',
        'accuracy',
        'heading',
        'speed',
        'gps_provider',
        'captured_at',
        'address',
        'ward_id',
        'district_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'altitude' => 'float',
            'accuracy' => 'float',
            'heading' => 'float',
            'speed' => 'float',
            'captured_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<\App\Modules\Departments\Models\Ward, $this>
     */
    public function ward(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Departments\Models\Ward::class, 'ward_id');
    }

    /**
     * @return BelongsTo<\App\Modules\Departments\Models\District, $this>
     */
    public function district(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Departments\Models\District::class, 'district_id');
    }
}
