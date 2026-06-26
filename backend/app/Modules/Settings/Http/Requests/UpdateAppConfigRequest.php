<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for PUT /api/v1/admin/app-configs/{app_config}.
 * All fields are optional — the service does a partial update
 * (drops nulls) so missing fields are preserved. The `key` is
 * NOT editable (a flag's identity is its key); a different
 * key requires a delete + create.
 */
class UpdateAppConfigRequest extends FormRequest
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
            'value' => ['sometimes', 'nullable'],
            'enabled' => ['sometimes', 'boolean'],
            'rollout_percentage' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'cohort' => ['sometimes', 'nullable', 'array'],
            'cohort.*' => ['array'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
