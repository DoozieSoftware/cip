<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CompleteDepartmentTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:4000'],
            'department_id' => ['nullable', 'uuid'],
        ];
    }
}
