<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class RescheduleTextileCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'scheduled_date' => ['required', 'date', 'after_or_equal:today'],
            'scheduled_window_start' => ['nullable', 'date_format:H:i'],
            'scheduled_window_end' => ['nullable', 'date_format:H:i', 'after:scheduled_window_start'],
            'reason' => ['nullable', 'string', 'min:5', 'max:2000'],
        ];
    }
}
