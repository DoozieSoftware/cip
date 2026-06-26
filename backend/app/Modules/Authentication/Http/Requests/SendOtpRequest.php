<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\In;

/**
 * Validates the request body for POST /api/v1/auth/send-otp.
 *
 * Per docs/11 §6 (citizen OTP) and docs/05 §5 (Send OTP endpoint).
 * The mobile number is the canonical citizen identifier; we accept
 * either 10-digit local or E.164.
 */
class SendOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string|In>>
     */
    public function rules(): array
    {
        return [
            'mobile' => [
                'required',
                'string',
                'regex:/^(\+?\d{1,3})?\d{10,12}$/',
            ],
        ];
    }

    /**
     * Normalise the mobile to 10-digit local form. E.164 prefixes are
     * stripped — the platform stores a canonical 10-digit mobile per
     * docs/04 §6.
     */
    public function mobile(): string
    {
        $rawInput = $this->input('mobile', '');
        $raw = is_string($rawInput) ? $rawInput : '';
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        // Strip a leading country code (91 for India) if the result
        // would be longer than 10 digits.
        if (strlen($digits) > 10) {
            $digits = substr($digits, -10);
        }

        return $digits;
    }
}
