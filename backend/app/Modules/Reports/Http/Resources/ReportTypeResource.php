<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Resources;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ReportType
 */
class ReportTypeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var ReportType $type */
        $type = $this->resource;

        return [
            'id' => $type->id,
            'name' => $type->name,
            'code' => $type->code,
            'description' => $type->description,
            'icon' => $type->icon,
            'color' => $type->color,
            'department_default_id' => $type->department_default_id,
            'requires_video' => (bool) $type->requires_video,
            'requires_photo' => (bool) $type->requires_photo,
            'min_photos' => $type->min_photos,
            'max_photos' => $type->max_photos,
            'workflow_definition_id' => $type->workflow_definition_id,
            'validation_rules' => $type->validation_rules,
            'active' => (bool) $type->active,
            'created_at' => $type->created_at?->toIso8601String(),
            'updated_at' => $type->updated_at?->toIso8601String(),
            'deleted_at' => $type->deleted_at?->toIso8601String(),
        ];
    }
}
