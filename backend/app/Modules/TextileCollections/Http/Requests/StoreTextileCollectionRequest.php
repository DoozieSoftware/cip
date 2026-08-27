<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreTextileCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:5', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'category' => [
                'nullable',
                Rule::in(TextileCollectionRequest::VALID_CATEGORIES),
            ],
            'service_zone_id' => ['required', 'uuid', 'exists:textile_service_zones,id'],
            'requester_type' => ['required', Rule::in(['individual', 'rwa'])],
            'requester_name' => ['required', 'string', 'min:2', 'max:255'],
            'rwa_name' => ['required_if:requester_type,rwa', 'nullable', 'string', 'min:2', 'max:255'],
            'contact_email' => ['required', 'email:rfc', 'max:255'],
            'contact_phone' => ['required', 'string', 'regex:/^[0-9+() -]{8,20}$/'],
            'pickup_address' => ['required', 'string', 'min:10', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'collection_method' => ['required', Rule::in(['dropoff', 'premises'])],
            // Requesters often cannot weigh their textiles, so either an
            // estimated bag count OR an estimated weight is enough for
            // route planning (SRS §6: "approximate quantity").
            'estimated_bags' => [
                'nullable',
                'required_without:estimated_weight_kg',
                'integer',
                'min:1',
                'max:999',
            ],
            'estimated_weight_kg' => [
                'nullable',
                'required_without:estimated_bags',
                'numeric',
                'min:0.1',
                'max:99999.99',
            ],
        ];
    }
}
