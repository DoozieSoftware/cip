<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInternalNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:1', 'max:4000'],
        ];
    }
}
