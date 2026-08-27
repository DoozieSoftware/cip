<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Departments\Models\Department;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string|null $department_id
 * @property-read Department|null $department
 */
final class TextileServiceZone extends Model
{
    use HasUuids;

    protected $table = 'textile_service_zones';

    /** @var list<string> */
    protected $fillable = [
        'code', 'name', 'department_id', 'center_latitude', 'center_longitude', 'service_radius_km',
        'dropoff_enabled', 'premises_pickup_enabled', 'dropoff_name',
        'dropoff_address', 'readiness_instructions', 'active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'center_latitude' => 'float',
            'center_longitude' => 'float',
            'service_radius_km' => 'float',
            'dropoff_enabled' => 'boolean',
            'premises_pickup_enabled' => 'boolean',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return HasMany<TextileCollectionRequest, $this> */
    public function requests(): HasMany
    {
        return $this->hasMany(TextileCollectionRequest::class, 'service_zone_id');
    }
}
