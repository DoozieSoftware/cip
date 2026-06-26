<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the request body for POST /api/v1/auth/refresh.
 *
 * The refresh token is the opaque plaintext returned by /verify-otp
 * (and by a previous /refresh). It is presented exactly once and
 * then replaced by the rotation service.
 */
class RefreshTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'refresh_token' => [
                'required',
                'string',
                'min:32',
            ],
        ];
    }

    public function refreshToken(): string
    {
        $raw = $this->input('refresh_token', '');

        return is_string($raw) ? $raw : '';
    }
}
