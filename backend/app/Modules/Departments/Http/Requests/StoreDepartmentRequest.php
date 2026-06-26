<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/departments.
 *
 * Per docs/05 §10 — every column is a string / scalar at the
 * wire boundary; the service applies structural validation
 * (e.g. escalation_matrix shape, parent existence).
 */
class StoreDepartmentRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:32', 'unique:departments,code'],
            'parent_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'jurisdiction' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'working_hours' => ['nullable', 'array'],
            'holiday_calendar' => ['nullable', 'array'],
            'default_workflow_id' => ['nullable', 'uuid'],
            'default_sla_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
            'escalation_matrix' => ['nullable', 'array'],
            'escalation_matrix.*' => ['array'],
            'escalation_matrix.*.after_minutes' => ['required_with:escalation_matrix.*', 'integer', 'min:1'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
