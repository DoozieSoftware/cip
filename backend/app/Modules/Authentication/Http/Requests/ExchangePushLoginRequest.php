<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExchangePushLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['request_secret' => ['required', 'string', 'size:64']];
    }

    public function requestSecret(): string
    {
        $value = $this->input('request_secret', '');

        return is_string($value) ? $value : '';
    }
}
