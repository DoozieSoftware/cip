<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-003 — Form Request for creating a `report_types` row.
 *
 * Validation per `docs/04` §7 — `code` is the stable slug
 * used by the citizen PWA and the routing rules engine,
 * so it is required, unique, and immutable-once-set.
 */
class StoreReportTypeRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('report_types', 'code')->whereNull('deleted_at'),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'icon' => ['nullable', 'string', 'max:64'],
            'color' => ['nullable', 'string', 'max:16'],
            'department_default_id' => ['nullable', 'string', 'uuid', 'exists:departments,id'],
            'requires_video' => ['nullable', 'boolean'],
            'requires_photo' => ['nullable', 'boolean'],
            'min_photos' => ['nullable', 'integer', 'min:0', 'max:99'],
            'max_photos' => ['nullable', 'integer', 'min:0', 'max:99'],
            'workflow_definition_id' => ['nullable', 'string', 'uuid'],
            'validation_rules' => ['nullable', 'array'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
