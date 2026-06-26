<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use App\Modules\Departments\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * DepartmentResource — the API representation of a Department.
 * Per AGENTS.md ("Never return Models directly") and docs/03 §20.
 *
 * Safe for both Super Admin (full payload) and read-only callers
 * (the resource does not strip any field — the controller is
 * responsible for picking the right audience and applying the
 * `super_admin` policy gate).
 *
 * @property-read Department $resource
 */
class DepartmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $dept = $this->resource;

        return [
            'id' => $dept->id,
            'name' => $dept->name,
            'code' => $dept->code,
            'parent_id' => $dept->parent_id,
            'jurisdiction' => $dept->jurisdiction,
            'address' => $dept->address,
            'email' => $dept->email,
            'phone' => $dept->phone,
            'working_hours' => $dept->working_hours,
            'holiday_calendar' => $dept->holiday_calendar,
            'default_workflow_id' => $dept->default_workflow_id,
            'default_sla_minutes' => $dept->default_sla_minutes,
            'escalation_matrix' => $dept->escalation_matrix,
            'active' => $dept->active,
            'created_at' => $dept->created_at?->toIso8601String(),
            'updated_at' => $dept->updated_at?->toIso8601String(),
            'deleted_at' => $dept->deleted_at?->toIso8601String(),
            'parent' => $dept->parent_id
                ? (new self($dept->parent))->toArray($request)
                : null,
            'children' => $dept->relationLoaded('children')
                ? self::collection($dept->children)->toArray($request)
                : null,
        ];
    }
}
