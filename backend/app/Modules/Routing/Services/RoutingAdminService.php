<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Repositories\RoutingRepository;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Super Admin write-side for routing rules per docs/09 §12.
 *
 * Owns the business rules for the CRUD:
 *  - `name` is the display label
 *  - `priority` is a positive int (lower = higher precedence)
 *  - the `conditions` payload is a JSON DSL; this service
 *    does not interpret it (RoutingCondition is the only
 *    consumer); the service only enforces the well-formed
 *    JSON shape
 *  - every write logs an `audit_logs` row with the
 *    before/after diff and the request id for traceability
 *  - reorder assigns priorities in 10-step increments so
 *    future inserts can be slotted in between
 */
class RoutingAdminService
{
    public function __construct(
        private readonly RoutingRepository $repository,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes, ?User $actor, ?Request $request): RoutingRule
    {
        return DB::transaction(function () use ($attributes, $actor, $request): RoutingRule {
            $rule = RoutingRule::query()->create([
                'name' => (string) $attributes['name'],
                'description' => $attributes['description'] ?? null,
                'priority' => isset($attributes['priority']) ? (int) $attributes['priority'] : 100,
                'conditions' => $this->normalizeConditions($attributes['conditions'] ?? []),
                'destination_department_id' => (string) $attributes['destination_department_id'],
                'default_officer_id' => $attributes['default_officer_id'] ?? null,
                'default_priority_id' => (string) $attributes['default_priority_id'],
                'default_sla_minutes' => (int) $attributes['default_sla_minutes'],
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : true,
            ]);

            $this->writeAudit($rule, null, $actor, $request, 'routing.create');

            $this->repository->invalidate();
            $this->writeAudit($rule, null, $actor, $request, 'routing.create');

            return $rule;
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(RoutingRule $rule, array $attributes, ?User $actor, ?Request $request): RoutingRule
    {
        return DB::transaction(function () use ($rule, $attributes, $actor, $request): RoutingRule {
            $before = $rule->only([
                'name', 'description', 'priority', 'conditions',
                'destination_department_id', 'default_officer_id',
                'default_priority_id', 'default_sla_minutes', 'active',
            ]);

            $rule->fill([
                'name' => (string) ($attributes['name'] ?? $rule->name),
                'description' => array_key_exists('description', $attributes) ? $attributes['description'] : $rule->description,
                'priority' => array_key_exists('priority', $attributes) ? (int) $attributes['priority'] : $rule->priority,
                'conditions' => array_key_exists('conditions', $attributes)
                    ? $this->normalizeConditions($attributes['conditions'])
                    : $rule->conditions,
                'destination_department_id' => (string) ($attributes['destination_department_id'] ?? $rule->destination_department_id),
                'default_officer_id' => array_key_exists('default_officer_id', $attributes) ? $attributes['default_officer_id'] : $rule->default_officer_id,
                'default_priority_id' => (string) ($attributes['default_priority_id'] ?? $rule->default_priority_id),
                'default_sla_minutes' => (int) ($attributes['default_sla_minutes'] ?? $rule->default_sla_minutes),
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : (bool) $rule->active,
            ])->save();

            $this->writeAudit($rule, $before, $actor, $request, 'routing.update');
            $this->repository->invalidate();

            return $rule->refresh();
        });
    }

    public function delete(RoutingRule $rule, ?User $actor, ?Request $request): void
    {
        DB::transaction(function () use ($rule, $actor, $request): void {
            $before = $rule->only(['name', 'priority', 'active']);
            $rule->delete();
            $this->writeAudit($rule, $before, $actor, $request, 'routing.delete');
            $this->repository->invalidate();
        });
    }

    /**
     * Reorder rules. The caller sends the desired final
     * order as a list of rule ids; the service assigns
     * priorities in 10-step increments starting at 10.
     *
     * @param  list<string>  $order
     */
    public function reorder(array $order, ?User $actor, ?Request $request): void
    {
        DB::transaction(function () use ($order, $actor, $request): void {
            $known = RoutingRule::query()->whereIn('id', $order)->pluck('id')->all();
            $missing = array_diff($order, $known);

            if ($missing !== []) {
                throw ApiException::notFound('RoutingRule');
            }

            $before = RoutingRule::query()->whereIn('id', $order)
                ->get(['id', 'priority'])
                ->keyBy('id')
                ->all();

            foreach (array_values($order) as $i => $id) {
                $priority = ($i + 1) * 10;
                RoutingRule::query()->where('id', $id)->update(['priority' => $priority]);
            }

            $after = RoutingRule::query()->whereIn('id', $order)
                ->get(['id', 'priority'])
                ->keyBy('id')
                ->all();

            $requestId = $request?->attributes->get('trace_id');

            $this->repository->invalidate();
            AuditLog::query()->create([
                'user_id' => $actor?->id,
                'entity' => 'routing_rules',
                'entity_id' => null,
                'action' => 'routing.reorder',
                'before' => ['order' => $before],
                'after' => ['order' => $after],
                'ip' => $request?->ip(),
                'device_fingerprint' => null,
                'request_id' => is_string($requestId) ? $requestId : null,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function buildSearchQuery(array $filters): Builder
    {
        $q = RoutingRule::query();

        if (isset($filters['q']) && is_string($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.$filters['q'].'%';
            $q->where(function (Builder $w) use ($needle): void {
                $w->where('name', 'like', $needle)->orWhere('description', 'like', $needle);
            });
        }

        if (array_key_exists('active', $filters) && $filters['active'] !== null) {
            $q->where('active', (bool) $filters['active']);
        }

        return $q->orderBy('priority')->orderBy('id');
    }

    /**
     * @param  array<string, mixed>|null  $conditions
     * @return array<string, mixed>
     */
    private function normalizeConditions(?array $conditions): array
    {
        if ($conditions === null) {
            return [];
        }

        return $conditions;
    }

    /**
     * @param  array<string, mixed>|null  $before
     */
    private function writeAudit(RoutingRule $rule, ?array $before, ?User $actor, ?Request $request, string $action): void
    {
        $requestId = $request?->attributes->get('trace_id');

        AuditLog::query()->create([
            'user_id' => $actor?->id,
            'entity' => 'routing_rules',
            'entity_id' => $rule->id,
            'action' => $action,
            'before' => $before,
            'after' => $rule->only([
                'name', 'priority', 'conditions',
                'destination_department_id', 'default_officer_id',
                'default_priority_id', 'default_sla_minutes', 'active',
            ]),
            'ip' => $request?->ip(),
            'device_fingerprint' => null,
            'request_id' => is_string($requestId) ? $requestId : null,
            'created_at' => now(),
        ]);
    }
}
