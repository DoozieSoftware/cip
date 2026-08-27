<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class CollectTextileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'actual_bags' => ['required', 'integer', 'min:1', 'max:999'],
            'actual_weight_kg' => ['required', 'numeric', 'min:0.1', 'max:99999.99'],
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'client_key' => ['nullable', 'string', 'max:128'],
        ];
    }
}
