<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use App\Modules\Users\Models\User;
use Database\Factories\Modules\Departments\Models\DepartmentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Department master per docs/04 §5 and docs/09 §7.
 *
 * Departments are the operational units that own reports.
 * A department may have a parent (hierarchical structure for
 * city-level → ward-level sub-offices) and a list of assigned
 * users (M:N pivot `department_users` — see T-M3-009).
 *
 *  - UUID primary key (HasUuids)
 *  - soft deletes (`deleted_at`) so historical reports keep
 *    pointing at the originating department even after the
 *    department is dissolved
 *  - parent_id self-FK with `nullOnDelete` (a child survives
 *    the parent's removal)
 *
 * @property string $id
 * @property string $name
 * @property string $code
 * @property string|null $parent_id
 * @property string|null $jurisdiction
 * @property string|null $address
 * @property string|null $email
 * @property string|null $phone
 * @property array<string, mixed>|null $working_hours
 * @property array<int, mixed>|null $holiday_calendar
 * @property string|null $default_workflow_id
 * @property int $default_sla_minutes
 * @property array<int, mixed>|null $escalation_matrix
 * @property bool $active
 */
class Department extends Model
{
    /**
     * @use HasFactory<DepartmentFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'departments';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'code',
        'parent_id',
        'jurisdiction',
        'address',
        'email',
        'phone',
        'working_hours',
        'holiday_calendar',
        'default_workflow_id',
        'default_sla_minutes',
        'escalation_matrix',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'working_hours' => 'array',
            'holiday_calendar' => 'array',
            'escalation_matrix' => 'array',
            'default_sla_minutes' => 'integer',
        ];
    }

    /**
     * Parent department (nullable; top-level departments have
     * no parent).
     *
     * @return BelongsTo<Department, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * Direct child departments. The full tree is exposed by
     * the GeographyService / master-config endpoint; this is
     * the one-hop accessor.
     *
     * @return HasMany<Department, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /**
     * M:N — Officers (and managers) attached to the
     * department through `department_users` (T-M3-009).
     * The pivot is exposed by `User::departments()` from
     * the inverse direction.
     *
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'department_users',
            'department_id',
            'user_id',
        )->withPivot(['id', 'is_manager', 'assigned_at'])
         ->withTimestamps();
    }
}
