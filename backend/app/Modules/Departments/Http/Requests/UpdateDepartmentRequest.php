<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form Request for PUT /api/v1/admin/departments/{id}.
 * All fields are optional; the service does a partial update
 * (drops nulls) so missing fields are preserved.
 */
class UpdateDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user instanceof User && $user->hasRole('super_admin');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $id = (string) $this->route('department');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:32', Rule::unique('departments', 'code')->ignore($id)],
            'parent_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
            'jurisdiction' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'working_hours' => ['sometimes', 'nullable', 'array'],
            'holiday_calendar' => ['sometimes', 'nullable', 'array'],
            'default_workflow_id' => ['sometimes', 'nullable', 'uuid'],
            'default_sla_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:525600'],
            'escalation_matrix' => ['sometimes', 'nullable', 'array'],
            'escalation_matrix.*' => ['array'],
            'escalation_matrix.*.after_minutes' => ['required_with:escalation_matrix.*', 'integer', 'min:1'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
