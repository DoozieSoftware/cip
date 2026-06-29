<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Http\Requests;

use App\Modules\Integrations\Models\Integration;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-007 — partial update for an Integration.
 *
 * `code` may be renamed (subject to uniqueness) — the
 * unique rule ignores the current row.
 */
class UpdateIntegrationRequest extends FormRequest
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
        $id = $this->route('integration');

        return [
            'code' => ['sometimes', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/', Rule::unique('integrations', 'code')->ignore($id)->whereNull('deleted_at')],
            'provider' => ['sometimes', 'string', 'max:64'],
            'display_name' => ['sometimes', 'string', 'max:128'],
            'base_url' => ['sometimes', 'string', 'max:512', 'url'],
            'credentials' => ['sometimes', 'array'],
            'settings' => ['nullable', 'array'],
            'status' => ['sometimes', 'string', Rule::in(Integration::STATUSES)],
        ];
    }
}
