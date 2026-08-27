<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateTextileInstructionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'readiness_instructions' => ['nullable', 'string', 'max:2000'],
            'contact_phone' => ['nullable', 'string', 'regex:/^[0-9+() -]{8,20}$/'],
            'contact_email' => ['nullable', 'email:rfc', 'max:255'],
            'pickup_address' => ['nullable', 'string', 'min:10', 'max:1000'],
        ];
    }
}
