<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordProductAnalyticsEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'event_code' => [
                'required',
                'string',
                'max:80',
                Rule::in([
                    'report_start_clicked',
                    'report_step_viewed',
                    'report_completed',
                    'report_queued_offline',
                    'gps_error',
                    'media_upload_failed',
                    'notification_delivery_failed',
                    'report_reopened',
                    'accessibility_preference_changed',
                ]),
            ],
            'properties' => ['sometimes', 'array', 'max:8'],
            'properties.*' => ['nullable', 'string', 'max:100'],
        ];
    }
}
