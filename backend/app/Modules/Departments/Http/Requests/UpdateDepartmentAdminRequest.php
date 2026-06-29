<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * T-M11-009 — Update the per-department admin surface
 * (SLA minutes, working hours, holiday calendar,
 * escalation matrix).
 *
 * The endpoint accepts a subset of the Department model
 * columns. The service layer enforces the structural
 * invariants (escalation_matrix shape etc.) so the
 * Form Request can stay schema-shaped.
 */
class UpdateDepartmentAdminRequest extends FormRequest
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
            'default_sla_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
            'working_hours' => ['nullable', 'array'],
            'working_hours.*' => ['array'],
            'working_hours.*.day' => ['required_with:working_hours.*', 'string', 'in:mon,tue,wed,thu,fri,sat,sun'],
            'working_hours.*.open' => ['required_with:working_hours.*', 'string', 'date_format:H:i'],
            'working_hours.*.close' => ['required_with:working_hours.*', 'string', 'date_format:H:i'],
            'holiday_calendar' => ['nullable', 'array'],
            'holiday_calendar.*' => ['string', 'date_format:Y-m-d'],
            'escalation_matrix' => ['nullable', 'array'],
            'escalation_matrix.*' => ['array'],
            'escalation_matrix.*.after_minutes' => ['required_with:escalation_matrix.*', 'integer', 'min:1'],
            'escalation_matrix.*.escalate_to' => ['nullable', 'uuid', 'exists:departments,id'],
        ];
    }
}
