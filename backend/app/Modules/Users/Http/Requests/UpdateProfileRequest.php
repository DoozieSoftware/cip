<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Validates the authenticated citizen's self-service profile update. */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('sanctum') instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $user = $this->user('sanctum');
        $userId = $user instanceof User ? $user->getAuthIdentifier() : null;

        return [
            'preferred_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'email' => [
                'sometimes',
                'nullable',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'preferred_locale' => ['sometimes', 'nullable', 'string', Rule::in(['en-IN', 'kn-IN'])],
            'notification_channel' => ['sometimes', 'string', Rule::in(['sms', 'push', 'email'])],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'preferred_locale.in' => 'Choose English or Kannada.',
            'notification_channel.in' => 'Choose SMS, push, or email notifications.',
        ];
    }
}
