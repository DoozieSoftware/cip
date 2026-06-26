<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for PUT /api/v1/admin/routing-rules/{rule}.
 */
class UpdateRoutingRuleRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', 'required', 'integer', 'min:0', 'max:1000000'],
            'conditions' => ['nullable', 'array'],
            'destination_department_id' => ['sometimes', 'required', 'string', 'exists:departments,id'],
            'default_officer_id' => ['nullable', 'string', 'exists:users,id'],
            'default_priority_id' => ['sometimes', 'required', 'string', 'exists:report_priorities,id'],
            'default_sla_minutes' => ['sometimes', 'required', 'integer', 'min:1', 'max:525600'],
            'active' => ['sometimes', 'required', 'boolean'],
        ];
    }
}
