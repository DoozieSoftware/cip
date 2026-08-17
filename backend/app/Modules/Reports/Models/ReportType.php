<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use Database\Factories\Modules\Reports\Models\ReportTypeFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * `report_types` row per docs/04 §7.
 *
 * Categories are NEVER hardcoded in code. The model is the
 * read-side of the citizen PWA's category list and the
 * submit-time validator (T-M4-021).
 *
 * @property string $id
 * @property string $name
 * @property string $code
 * @property string|null $description
 * @property string|null $icon
 * @property string|null $color
 * @property array<string, string>|null $localizations
 * @property array<int, string>|null $aliases
 * @property string|null $department_default_id
 * @property bool $requires_video
 * @property bool $requires_photo
 * @property int $min_photos
 * @property int $max_photos
 * @property int|null $response_target_minutes
 * @property string|null $workflow_definition_id
 * @property array<string, mixed>|null $validation_rules
 * @property int $sort_order
 * @property bool $active
 */
class ReportType extends Model
{
    /**
     * @use HasFactory<ReportTypeFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'report_types';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'code',
        'description',
        'icon',
        'color',
        'localizations',
        'aliases',
        'department_default_id',
        'requires_video',
        'requires_photo',
        'min_photos',
        'max_photos',
        'response_target_minutes',
        'workflow_definition_id',
        'validation_rules',
        'sort_order',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requires_video' => 'boolean',
            'requires_photo' => 'boolean',
            'localizations' => 'array',
            'aliases' => 'array',
            'min_photos' => 'integer',
            'max_photos' => 'integer',
            'response_target_minutes' => 'integer',
            'validation_rules' => 'array',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Department, $this>
     */
    public function departmentDefault(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_default_id');
    }
}
