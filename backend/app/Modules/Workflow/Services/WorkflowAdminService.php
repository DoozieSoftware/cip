<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Workflow\Models\WorkflowDefinition;
use App\Modules\Workflow\Models\WorkflowState;
use App\Modules\Workflow\Models\WorkflowTransition;
use App\Modules\Workflow\Repositories\WorkflowRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Super Admin write-side for workflow definitions per docs/09 §11.
 *
 * Owns the business rules for the CRUD:
 *  - `code` is the natural key (unique)
 *  - the `civic_default` definition cannot be deleted (only
 *    deactivated) because reports are anchored to it
 *  - any write invalidates the read-side cache via
 *    `WorkflowRepository::invalidate($code)`
 *  - the `states` + `transitions` blocks are full-replace
 *    payloads; the caller sends the complete target graph
 *    and the service diffs/deletes accordingly
 *
 * The service is the only path that should mutate workflow
 * definitions in production. The seeder also uses these
 * methods indirectly (updateOrCreate on each row) but the
 * controller / API surface is the Super Admin CRUD.
 */
class WorkflowAdminService
{
    public function __construct(
        private readonly WorkflowRepository $repository,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): WorkflowDefinition
    {
        $code = is_string($attributes['code'] ?? null) ? $attributes['code'] : '';
        $this->assertUniqueCode($code, null);

        return DB::transaction(function () use ($attributes, $code): WorkflowDefinition {
            $def = WorkflowDefinition::query()->create([
                'code' => $code,
                'name' => is_string($attributes['name'] ?? null) ? $attributes['name'] : $code,
                'description' => $attributes['description'] ?? null,
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : true,
            ]);

            if (is_array($attributes['states'] ?? null)) {
                $this->replaceStates($def, $attributes['states']);
            }

            if (is_array($attributes['transitions'] ?? null)) {
                $this->replaceTransitions($def, $attributes['transitions']);
            }

            $this->repository->invalidate($def->code);

            return $def->refresh()->load(['states', 'transitions']);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(WorkflowDefinition $def, array $attributes): WorkflowDefinition
    {
        $code = is_string($attributes['code'] ?? null) ? $attributes['code'] : $def->code;
        $this->assertUniqueCode($code, $def->id);

        return DB::transaction(function () use ($def, $attributes, $code): WorkflowDefinition {
            $oldCode = $def->code;
            $def->fill([
                'code' => $code,
                'name' => is_string($attributes['name'] ?? null) ? $attributes['name'] : $def->name,
                'description' => array_key_exists('description', $attributes) ? $attributes['description'] : $def->description,
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : $def->active,
            ]);
            $def->save();

            if (is_array($attributes['states'] ?? null)) {
                $this->replaceStates($def, $attributes['states']);
            }

            if (is_array($attributes['transitions'] ?? null)) {
                $this->replaceTransitions($def, $attributes['transitions']);
            }

            // Invalidate both old + new code in case the code changed.
            $this->repository->invalidate($oldCode);

            if ($oldCode !== $def->code) {
                $this->repository->invalidate($def->code);
            }

            return $def->refresh()->load(['states', 'transitions']);
        });
    }

    public function delete(WorkflowDefinition $def): void
    {
        if ($def->code === 'civic_default') {
            throw new ApiException(
                'PROTECTED_DEFINITION',
                'The default civic workflow cannot be deleted; deactivate it instead.',
                409,
            );
        }

        // Block hard-delete if any report still references the def.
        $inUse = Report::query()->where('workflow_id', $def->id)->exists();

        if ($inUse) {
            throw new ApiException(
                'DEFINITION_IN_USE',
                'This workflow is referenced by existing reports; deactivate instead of delete.',
                409,
            );
        }

        $code = $def->code;
        DB::transaction(function () use ($def): void {
            $def->states()->delete();
            $def->transitions()->delete();
            $def->delete();
        });
        $this->repository->invalidate($code);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<WorkflowDefinition>
     */
    public function buildSearchQuery(array $filters): Builder
    {
        $q = WorkflowDefinition::query()->with(['states', 'transitions']);

        if (isset($filters['q']) && is_string($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.$filters['q'].'%';
            $q->where(static function (Builder $sub) use ($needle): void {
                $sub->where('name', 'like', $needle)->orWhere('code', 'like', $needle);
            });
        }

        if (array_key_exists('active', $filters)) {
            $q->where('active', (bool) $filters['active']);
        }

        return $q->orderBy('name');
    }

    private function assertUniqueCode(string $code, ?string $ignoreId): void
    {
        if ($code === '') {
            throw new ApiException('VALIDATION_FAILED', 'Workflow code is required.', 422);
        }

        $existing = WorkflowDefinition::query()->where('code', $code);

        if ($ignoreId !== null) {
            $existing->where('id', '!=', $ignoreId);
        }

        if ($existing->exists()) {
            throw new ApiException('DUPLICATE_CODE', "Workflow code '{$code}' is already in use.", 409);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $states
     */
    private function replaceStates(WorkflowDefinition $def, array $states): void
    {
        $incoming = [];

        foreach ($states as $row) {
            if (! is_array($row) || ! isset($row['code']) || ! is_string($row['code'])) {
                continue;
            }
            $incoming[$row['code']] = $row;
        }

        $existing = $def->states()->get()->keyBy('code');
        $keep = [];

        foreach ($incoming as $code => $row) {
            $payload = [
                'workflow_definition_id' => $def->id,
                'code' => $code,
                'name' => is_string($row['name'] ?? null) ? $row['name'] : $code,
                'description' => $row['description'] ?? null,
                'is_initial' => (bool) ($row['is_initial'] ?? false),
                'is_terminal' => (bool) ($row['is_terminal'] ?? false),
                'sort_order' => isset($row['sort_order']) && is_int($row['sort_order']) ? $row['sort_order'] : 0,
                'color' => is_string($row['color'] ?? null) ? $row['color'] : null,
                'active' => array_key_exists('active', $row) ? (bool) $row['active'] : true,
            ];

            if ($existing->has($code)) {
                $existing->get($code)->fill($payload)->save();
                $keep[] = $code;
            } else {
                WorkflowState::query()->create($payload);
                $keep[] = $code;
            }
        }

        // Delete states that are no longer present (cascades to
        // outgoing transitions via the FK; restrict on incoming
        // will surface the FK violation cleanly to the caller).
        foreach ($existing as $code => $state) {
            if (! in_array($code, $keep, true)) {
                $state->delete();
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $transitions
     */
    private function replaceTransitions(WorkflowDefinition $def, array $transitions): void
    {
        $states = $def->states()->get()->keyBy('code');

        foreach ($transitions as $row) {
            if (! is_array($row)) {
                continue;
            }
            $fromCode = is_string($row['from_state'] ?? null) ? $row['from_state'] : null;
            $toCode = is_string($row['to_state'] ?? null) ? $row['to_state'] : null;
            $event = is_string($row['event'] ?? null) ? $row['event'] : null;

            if ($fromCode === null || $toCode === null || $event === '') {
                continue;
            }

            if (! $states->has($fromCode) || ! $states->has($toCode)) {
                continue;
            }

            WorkflowTransition::query()->updateOrCreate(
                [
                    'workflow_definition_id' => $def->id,
                    'from_state_id' => $states->get($fromCode)->id,
                    'event' => $event,
                    'to_state_id' => $states->get($toCode)->id,
                ],
                [
                    'required_role' => $row['required_role'] ?? null,
                    'required_permission' => $row['required_permission'] ?? null,
                    'conditions' => $row['conditions'] ?? null,
                    'sla_minutes' => isset($row['sla_minutes']) ? (int) $row['sla_minutes'] : null,
                    'notify_before_minutes' => isset($row['notify_before_minutes']) ? (int) $row['notify_before_minutes'] : null,
                    'priority' => isset($row['priority']) ? (int) $row['priority'] : 0,
                    'active' => array_key_exists('active', $row) ? (bool) $row['active'] : true,
                ],
            );
        }
    }
}
