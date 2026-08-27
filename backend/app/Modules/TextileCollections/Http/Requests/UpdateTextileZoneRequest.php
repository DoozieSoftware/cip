<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateTextileZoneRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() instanceof User; }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'dropoff_name' => ['nullable','string','max:255'],
            'dropoff_address' => ['nullable','string','max:1000'],
            'operating_hours' => ['nullable','array'],
            'public_phone' => ['nullable','string','max:32'],
            'centre_status' => ['nullable', Rule::in(['open','temporarily_closed'])],
            'centre_closed_note' => ['nullable','string','max:2000'],
            'receipt_requires_photo' => ['nullable','boolean'],
            'receipt_requires_bags' => ['nullable','boolean'],
            'receipt_requires_weight' => ['nullable','boolean'],
            'max_open_dropoffs_per_citizen' => ['nullable','integer','min:1','max:100'],
        ];
    }
}
