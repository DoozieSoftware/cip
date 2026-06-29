<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDepartmentActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
            'reason_code' => ['nullable', 'string', 'max:64'],
        ];
    }
}
