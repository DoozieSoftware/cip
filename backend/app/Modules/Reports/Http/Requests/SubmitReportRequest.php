<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Requests;

use App\Modules\Reports\Rules\LocationAccuracy;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * SubmitReportRequest per docs/05 §6, §7 and docs/11 §12.
 *
 * Validates the citizen-submit wire payload. `latitude` /
 * `longitude` / `accuracy` / `title` / `description` /
 * `is_anonymous` / `report_type_id` are required; GPS range and
 * accuracy are gated by the LocationAccuracy rule; speed sanity
 * is enforced by the LocationService on the service side.
 *
 * The `idempotency_key` is a request-level convenience: clients
 * can also supply the `Idempotency-Key` header — the middleware
 * reads the header; this field is for clients that prefer to
 * embed it in the body. The middleware is the source of truth.
 */
class SubmitReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user instanceof User;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'report_type_id' => ['required', 'uuid', 'exists:report_types,id'],
            'title' => ['required', 'string', 'min:5', 'max:255'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'is_anonymous' => ['nullable', 'boolean'],

            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', new LocationAccuracy],
            'altitude' => ['nullable', 'numeric'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'speed' => ['nullable', 'numeric', 'between:0,200'],
            'gps_provider' => ['nullable', 'string', 'max:64'],
            'captured_at' => ['nullable', 'date'],

            'priority_id' => ['nullable', 'uuid', 'exists:report_priorities,id'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'latitude.between' => 'The latitude must be between -90 and 90 degrees.',
            'longitude.between' => 'The longitude must be between -180 and 180 degrees.',
            'speed.between' => 'The reported speed is unrealistic.',
        ];
    }
}
