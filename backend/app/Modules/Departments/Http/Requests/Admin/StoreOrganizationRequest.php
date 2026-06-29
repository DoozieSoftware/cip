<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-013 — create an organization.
 */
class StoreOrganizationRequest extends FormRequest
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
        return [
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/', Rule::unique('organizations', 'code')->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:128'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'domain' => ['nullable', 'string', 'max:128'],
            'contact' => ['nullable', 'array'],
            'contact.email' => ['nullable', 'email'],
            'contact.phone' => ['nullable', 'string', 'max:32'],
            'contact.address' => ['nullable', 'string', 'max:512'],
            'branding' => ['nullable', 'array'],
            'branding.logo_url' => ['nullable', 'string', 'max:512', 'url'],
            'branding.primary_color' => ['nullable', 'string', 'max:16'],
            'branding.secondary_color' => ['nullable', 'string', 'max:16'],
            'storage_quota_mb' => ['nullable', 'integer', 'min:0', 'max:1048576'],
            'settings' => ['nullable', 'array'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
