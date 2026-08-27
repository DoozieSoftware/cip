<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class CreateCollectionBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'service_zone_id' => ['required', 'uuid', 'exists:textile_service_zones,id'],
            'collection_request_ids' => ['required', 'array', 'min:1', 'max:250'],
            'collection_request_ids.*' => ['required', 'uuid', 'distinct', 'exists:textile_collection_requests,id'],
            'collection_date' => ['required', 'date', 'after_or_equal:today'],
            'window_start' => ['nullable', 'date_format:H:i'],
            'window_end' => ['nullable', 'date_format:H:i', 'after:window_start'],
            'trip_reference' => ['nullable', 'string', 'max:64'],
            'instructions' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
