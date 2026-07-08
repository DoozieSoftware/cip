<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * T-M12-009 — partial update for a notification channel config.
 */
class UpdateNotificationChannelConfigRequest extends FormRequest
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
            'display_name' => ['sometimes', 'string', 'max:128'],
            'credentials' => ['sometimes', 'array'],
            'retry_policy' => ['sometimes', 'array'],
            'retry_policy.tries' => ['nullable', 'integer', 'min:1', 'max:10'],
            'retry_policy.backoff' => ['nullable', 'array', 'max:10'],
            'retry_policy.backoff.*' => ['integer', 'min:1', 'max:86400'],
            'settings' => ['nullable', 'array'],
            'per_locale_defaults' => ['nullable', 'array'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
