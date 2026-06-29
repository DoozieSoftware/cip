<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-013 — partial update for an organization.
 */
class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && method_exists($user, 'hasRole')
            && $user->hasRole('super_admin');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var string|null $id */
        $id = $this->route('organization');

        return [
            'code' => ['sometimes', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/', Rule::unique('organizations', 'code')->ignore($id)->whereNull('deleted_at')],
            'name' => ['sometimes', 'string', 'max:128'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'domain' => ['nullable', 'string', 'max:128'],
            'contact' => ['nullable', 'array'],
            'branding' => ['nullable', 'array'],
            'storage_quota_mb' => ['sometimes', 'integer', 'min:0', 'max:1048576'],
            'settings' => ['nullable', 'array'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
