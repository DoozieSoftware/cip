<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the authenticated user's profile update.
 *
 * Besides the preference fields, staff and citizen users may update
 * their display `name` and their login `mobile`. The mobile is
 * normalised to the canonical 10-digit local form before validation
 * (the same rule SendOtpRequest uses to accept a number at login), so
 * the uniqueness check and stored value both use the platform form.
 */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('sanctum') instanceof User;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $user = $this->user('sanctum');
        $userId = $user instanceof User ? $user->getAuthIdentifier() : null;

        return [
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'preferred_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'email' => [
                'sometimes',
                'nullable',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'mobile' => [
                'sometimes',
                'string',
                'regex:/^(\+?\d{1,3})?\d{10,12}$/',
                Rule::unique('users', 'mobile')->ignore($userId),
            ],
            'preferred_locale' => ['sometimes', 'nullable', 'string', Rule::in(['en-IN', 'kn-IN'])],
            'notification_channel' => ['sometimes', 'string', Rule::in(['sms', 'push', 'email'])],
        ];
    }

    /**
     * Normalise a supplied mobile to the canonical 10-digit local form
     * before validation, mirroring SendOtpRequest::mobile().
     */
    protected function prepareForValidation(): void
    {
        $rawMobile = $this->input('mobile');

        if (! is_string($rawMobile)) {
            return;
        }

        $digits = preg_replace('/\D+/', '', $rawMobile) ?? '';

        // Strip a leading country code (91 for India) if the result
        // would be longer than 10 digits.
        if (strlen($digits) > 10) {
            $digits = substr($digits, -10);
        }

        $this->merge(['mobile' => $digits]);
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.max' => 'Name is too long.',
            'mobile.regex' => 'Enter a valid 10-digit mobile number, optionally with a country code.',
            'mobile.unique' => 'That mobile number is already in use by another account.',
            'preferred_locale.in' => 'Choose English or Kannada.',
            'notification_channel.in' => 'Choose SMS, push, or email notifications.',
        ];
    }
}
