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

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
            'reason_code' => ['nullable', 'string', 'max:64'],
            'expected_workflow_version' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
