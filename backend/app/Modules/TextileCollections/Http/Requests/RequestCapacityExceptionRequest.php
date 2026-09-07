<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RequestCapacityExceptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'reason_code' => ['nullable', 'string', 'in:below_minimum,high_value,urgent,vehicle_mismatch,capacity_override'],
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
            'payload_snapshot' => ['nullable', 'array'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ];
    }
}
