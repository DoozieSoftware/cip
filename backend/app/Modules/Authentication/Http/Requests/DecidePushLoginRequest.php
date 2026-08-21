<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DecidePushLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['approval_secret' => ['required', 'string', 'size:64']];
    }

    public function approvalSecret(): string
    {
        $value = $this->input('approval_secret', '');

        return is_string($value) ? $value : '';
    }
}
