<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreCitizenActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('sanctum') instanceof User;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'min:5', 'max:1000'],
            'expected_workflow_version' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
