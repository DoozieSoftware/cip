<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-003 — Form Request for updating a `report_types` row.
 *
 * All fields are optional on update; an empty patch is a
 * no-op. `code` stays unique-skipping-self so renaming is
 * allowed but cannot collide with a sibling row.
 */
class UpdateReportTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && method_exists($user, 'hasAnyRole')
            && $user->hasAnyRole(['super_admin', 'system']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $routeParam = $this->route('report_type');
        $ignoreId = is_string($routeParam) ? $routeParam : null;

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('report_types', 'code')
                    ->ignore($ignoreId)
                    ->whereNull('deleted_at'),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:64'],
            'color' => ['sometimes', 'nullable', 'string', 'max:16'],
            'department_default_id' => ['sometimes', 'nullable', 'string', 'uuid', 'exists:departments,id'],
            'requires_video' => ['sometimes', 'boolean'],
            'requires_photo' => ['sometimes', 'boolean'],
            'min_photos' => ['sometimes', 'integer', 'min:0', 'max:99'],
            'max_photos' => ['sometimes', 'integer', 'min:0', 'max:99'],
            'workflow_definition_id' => ['sometimes', 'nullable', 'string', 'uuid'],
            'validation_rules' => ['sometimes', 'nullable', 'array'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
