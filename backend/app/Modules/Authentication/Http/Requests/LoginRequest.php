<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the request body for POST /api/v1/auth/login — the
 * staff password-login flow (docs/11 §8). Citizens are OTP-only and
 * never use this endpoint.
 */
class LoginRequest extends FormRequest
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
            'mobile' => [
                'required',
                'string',
                'regex:/^(\+?\d{1,3})?\d{10,12}$/',
            ],
            'password' => [
                'required',
                'string',
            ],
        ];
    }

    /**
     * Normalised 10-digit mobile — see SendOtpRequest::mobile.
     */
    public function mobile(): string
    {
        $rawInput = $this->input('mobile', '');
        $raw = is_string($rawInput) ? $rawInput : '';
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (strlen($digits) > 10) {
            $digits = substr($digits, -10);
        }

        return $digits;
    }

    public function password(): string
    {
        $raw = $this->input('password', '');

        return is_string($raw) ? $raw : '';
    }
}
