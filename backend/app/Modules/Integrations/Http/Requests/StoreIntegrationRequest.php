<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Http\Requests;

use App\Modules\Integrations\Models\Integration;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-007 — create an Integration.
 *
 * The `credentials` field is required at the request
 * level (the Super Admin UI always supplies it) but the
 * value is masked in the response.
 */
class StoreIntegrationRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/', Rule::unique('integrations', 'code')->whereNull('deleted_at')],
            'provider' => ['required', 'string', 'max:64'],
            'display_name' => ['required', 'string', 'max:128'],
            'base_url' => ['required', 'string', 'max:512', 'url'],
            'credentials' => ['required', 'array'],
            'settings' => ['nullable', 'array'],
            'status' => ['nullable', 'string', Rule::in(Integration::STATUSES)],
        ];
    }
}
