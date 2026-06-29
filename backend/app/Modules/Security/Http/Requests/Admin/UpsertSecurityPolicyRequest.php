<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Requests\Admin;

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-010 — Form Request for upserting a `security_policies` row.
 */
class UpsertSecurityPolicyRequest extends FormRequest
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
            'key' => ['required', 'string', 'max:128', 'regex:/^[a-z0-9._]+$/'],
            'value' => ['nullable', 'array'],
            'type' => ['nullable', 'string', Rule::in(SecurityPolicy::TYPES)],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }
}
