<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RecordCollectionOutcomeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'outcome' => ['required', Rule::in(['collected', 'missed', 'rejected', 'cancelled'])],
            'actual_bags' => ['required_if:outcome,collected', 'nullable', 'integer', 'min:1', 'max:999'],
            'actual_weight_kg' => ['required_if:outcome,collected', 'nullable', 'numeric', 'min:0.1', 'max:99999.99'],
            'reason' => ['required_unless:outcome,collected', 'nullable', 'string', 'min:5', 'max:2000'],
        ];
    }
}
