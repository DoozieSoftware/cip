<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class ApproveTextileCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'dropoff_valid_from' => ['nullable', 'date'],
            'dropoff_valid_until' => ['nullable', 'date', 'after_or_equal:dropoff_valid_from'],
        ];
    }
}
