<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form Request for POST /api/v1/admin/settings.
 *
 * Per docs/09 §18 and docs/04 §18 — every setting is a row
 * identified by a dotted `key`; `value` is stored as JSON and
 * `type` tells the reader how to coerce it back.
 *
 *  - `key` is required, unique across the table (case-sensitive).
 *  - `type` must be one of the supported coercion targets
 *    (string, int, bool, json, datetime) — see Setting::coerce.
 *  - `value` is required and must be a scalar or an array
 *    (the value is JSON-encoded before storage, so a bare
 *    string "true" is stored as the JSON string "true" —
 *    pass a real boolean for booleans).
 */
class StoreSettingRequest extends FormRequest
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
            'key' => ['required', 'string', 'max:255', 'unique:settings,key'],
            'value' => ['required'],
            'type' => ['required', 'string', Rule::in(['string', 'int', 'integer', 'bool', 'boolean', 'json', 'datetime'])],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_public' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'key.required' => 'A setting key is required.',
            'key.unique' => 'A setting with this key already exists.',
            'value.required' => 'A setting value is required.',
            'type.in' => 'type must be one of: string, int, bool, json, datetime.',
        ];
    }
}
