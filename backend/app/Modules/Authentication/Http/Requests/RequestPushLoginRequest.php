<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RequestPushLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['mobile' => ['required', 'string', 'regex:/^(\+?\d{1,3})?\d{10,12}$/']];
    }

    public function mobile(): string
    {
        $input = $this->input('mobile', '');
        $digits = preg_replace('/\D+/', '', is_string($input) ? $input : '') ?? '';

        return strlen($digits) > 10 ? substr($digits, -10) : $digits;
    }
}
