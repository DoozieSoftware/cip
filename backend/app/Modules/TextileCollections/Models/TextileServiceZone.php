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
        'operating_hours', 'public_phone', 'centre_status', 'centre_closed_note',
        'receipt_requires_photo', 'receipt_requires_bags', 'receipt_requires_weight',
        'max_open_dropoffs_per_citizen',
    ]; // TODO D-01..D-03,D-07 zone config; separate dropoff_centres pending D-01 option b

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
            'operating_hours' => 'array',
            'receipt_requires_photo' => 'boolean',
            'receipt_requires_bags' => 'boolean',
            'receipt_requires_weight' => 'boolean',
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
