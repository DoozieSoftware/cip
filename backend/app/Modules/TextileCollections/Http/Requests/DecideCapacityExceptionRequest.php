<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class DecideCapacityExceptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', 'in:approve,reject'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
