<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $service_zone_id
 * @property string $department_id
 * @property string|null $effective_from
 * @property string|null $effective_to
 * @property int|null $day_of_week
 * @property int|null $max_bags
 * @property float|null $max_weight_kg
 * @property int|null $max_stops
 * @property int|null $min_bags
 * @property float|null $min_weight_kg
 * @property array<string, mixed>|null $vehicle_requirements
 * @property array<int, string>|null $category_allowlist
 * @property string|null $guidance_text
 * @property string|null $policy_notes
 */
final class TextileCapacityRule extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'textile_capacity_rules';

    /** @var list<string> */
    protected $fillable = [
        'service_zone_id',
        'department_id',
        'effective_from',
        'effective_to',
        'day_of_week',
        'max_bags',
        'max_weight_kg',
        'max_stops',
        'min_bags',
        'min_weight_kg',
        'vehicle_requirements',
        'category_allowlist',
        'guidance_text',
        'policy_notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'day_of_week' => 'integer',
            'max_bags' => 'integer',
            'max_weight_kg' => 'float',
            'max_stops' => 'integer',
            'min_bags' => 'integer',
            'min_weight_kg' => 'float',
            'vehicle_requirements' => 'array',
            'category_allowlist' => 'array',
        ];
    }

    /** @return BelongsTo<TextileServiceZone, $this> */
    public function serviceZone(): BelongsTo
    {
        return $this->belongsTo(TextileServiceZone::class, 'service_zone_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
