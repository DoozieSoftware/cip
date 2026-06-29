<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Admin;

use App\Modules\Notifications\Models\NotificationChannelConfig;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-009 — create a notification channel config.
 */
class StoreNotificationChannelConfigRequest extends FormRequest
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
            'channel' => ['required', 'string', Rule::in(NotificationChannelConfig::CHANNELS)],
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/'],
            'display_name' => ['required', 'string', 'max:128'],
            'credentials' => ['required', 'array'],
            'retry_policy' => ['nullable', 'array'],
            'retry_policy.tries' => ['nullable', 'integer', 'min:1', 'max:10'],
            'retry_policy.backoff' => ['nullable', 'array', 'max:10'],
            'retry_policy.backoff.*' => ['integer', 'min:1', 'max:86400'],
            'settings' => ['nullable', 'array'],
            'per_locale_defaults' => ['nullable', 'array'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
