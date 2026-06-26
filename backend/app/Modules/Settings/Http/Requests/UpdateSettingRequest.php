<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form Request for PUT /api/v1/admin/settings/{setting}.
 *
 * All fields are optional — the service does a partial update
 * (drops nulls) so missing fields are preserved. The `key` is
 * NOT editable (a setting's identity is its key); a different
 * key requires a delete + create.
 */
class UpdateSettingRequest extends FormRequest
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
            'value' => ['sometimes', 'required'],
            'type' => ['sometimes', 'string', Rule::in(['string', 'int', 'integer', 'bool', 'boolean', 'json', 'datetime'])],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_public' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in' => 'type must be one of: string, int, bool, json, datetime.',
        ];
    }
}
