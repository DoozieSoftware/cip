<?php

declare(strict_types=1);

namespace App\Modules\Routing\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Users\Models\User;
use Database\Factories\Modules\Routing\Models\RoutingRuleFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * `routing_rules` row per docs/04 sec 12.
 *
 * A routing rule binds a JSON `conditions` payload to a
 * destination department (and optionally a default officer
 * and a default priority / SLA). The M7 RoutingEngine
 * evaluates every active rule in (priority asc, created_at
 * asc) order; the first one whose conditions match the
 * report wins and the report is routed to the rule's
 * `destination_department_id`.
 *
 *  - UUID PK
 *  - `conditions` is JSON-cast; the RoutingCondition DSL
 *    parser is the only consumer of this payload
 *  - `active` + `deleted_at` together let a Super Admin
 *    retire a rule without losing the audit trail
 *  - `priority` is `int`, lower = higher precedence; the
 *    default 100 keeps new rules at the back of the line
 *    until the Super Admin re-orders them
 *
 * @property string $id
 * @property string $name
 * @property int $priority
 * @property array<string, mixed> $conditions
 * @property string $destination_department_id
 * @property string|null $default_officer_id
 * @property string $default_priority_id
 * @property int $default_sla_minutes
 * @property bool $active
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class RoutingRule extends Model
{
    /** @use HasFactory<RoutingRuleFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'routing_rules';

    /** @var list<string> */
    protected $fillable = [
        'name', 'priority', 'conditions',
        'destination_department_id', 'default_officer_id',
        'default_priority_id', 'default_sla_minutes',
        'active', 'description',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'conditions' => 'array',
            'priority' => 'integer',
            'default_sla_minutes' => 'integer',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Department, $this> */
    public function destinationDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'destination_department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function defaultOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'default_officer_id');
    }

    /** @return BelongsTo<ReportPriority, $this> */
    public function defaultPriority(): BelongsTo
    {
        return $this->belongsTo(ReportPriority::class, 'default_priority_id');
    }
}
