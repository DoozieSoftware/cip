<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\Ward;
use Database\Factories\Modules\Reports\Models\LocationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

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
 * @property Carbon|null $captured_at
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

    protected static function booted(): void
    {
        static::saved(function (self $location): void {
            $location->syncGeom();
        });
    }

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
     * @return BelongsTo<Ward, $this>
     */
    public function ward(): BelongsTo
    {
        return $this->belongsTo(Ward::class, 'ward_id');
    }

    /**
     * @return BelongsTo<District, $this>
     */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class, 'district_id');
    }

    private function syncGeom(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        /** @var Builder<self> $query */
        $query = self::query()->whereKey($this->getKey());
        $query->update([
            'geom' => DB::raw(self::geomExpression($this->latitude, $this->longitude)),
        ]);
    }

    private static function geomExpression(float $latitude, float $longitude): string
    {
        $lat = number_format($latitude, 7, '.', '');
        $lng = number_format($longitude, 7, '.', '');

        return self::supportsSrid()
            ? "ST_SRID(POINT({$lng}, {$lat}), 4326)"
            : "POINT({$lng}, {$lat})";
    }

    private static function supportsSrid(): bool
    {
        $versionRow = DB::selectOne('select version() as version');
        $version = strtolower((string) ($versionRow->version ?? ''));

        if (str_contains($version, 'mariadb')) {
            return false;
        }

        $normalizedVersion = preg_replace('/-[a-z0-9].*$/i', '', $version) ?: $version;

        return version_compare($normalizedVersion, '8.0', '>=');
    }
}
