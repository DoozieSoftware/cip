<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateCapacityRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'day_of_week' => ['nullable', 'integer', 'between:0,6'],
            'max_bags' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'max_weight_kg' => ['nullable', 'numeric', 'min:0.1', 'max:100000'],
            'max_stops' => ['nullable', 'integer', 'min:1', 'max:500'],
            'min_bags' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'min_weight_kg' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'vehicle_requirements' => ['nullable', 'array'],
            'category_allowlist' => ['nullable', 'array'],
            'category_allowlist.*' => ['string', 'in:clothes_waste,metal_scrap,e_waste'],
            'guidance_text' => ['nullable', 'string', 'max:1000'],
            'policy_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
