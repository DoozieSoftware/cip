<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/routing-rules.
 *
 * Per docs/09 sec 12 - Super Admin creates a new routing
 * rule. The `conditions` block follows the M7
 * RoutingCondition DSL (operators: category_in, ward_in,
 * district_in, severity_in, keyword_match,
 * time_of_day_between, ai_label_in).
 */
class StoreRoutingRuleRequest extends FormRequest
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
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'conditions' => ['nullable', 'array'],
            'destination_department_id' => ['required', 'string', 'exists:departments,id'],
            'default_officer_id' => ['nullable', 'string', 'exists:users,id'],
            'default_priority_id' => ['required', 'string', 'exists:report_priorities,id'],
            'default_sla_minutes' => ['required', 'integer', 'min:1', 'max:525600'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
