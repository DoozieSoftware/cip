<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/app-configs.
 *
 * Per docs/09 §18 — a feature flag row carries:
 *  - `key` (required, unique, dotted identifier)
 *  - `value` (optional JSON payload returned when the flag is on)
 *  - `enabled` (master switch)
 *  - `rollout_percentage` (0-100, deterministic SHA-256 bucket)
 *  - `cohort` (array of {attribute: value} predicates, ANY
 *    predicate match short-circuits the flag to true)
 *  - `description` (free text for the Super Admin UI)
 */
class StoreAppConfigRequest extends FormRequest
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
            'key' => ['required', 'string', 'max:255', 'unique:app_configs,key'],
            'value' => ['nullable'],
            'enabled' => ['nullable', 'boolean'],
            'rollout_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cohort' => ['nullable', 'array'],
            'cohort.*' => ['array'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'key.required' => 'A feature-flag key is required.',
            'key.unique' => 'A feature flag with this key already exists.',
            'rollout_percentage.min' => 'rollout_percentage must be 0-100.',
            'rollout_percentage.max' => 'rollout_percentage must be 0-100.',
        ];
    }
}
