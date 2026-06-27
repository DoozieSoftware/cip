<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Requests;

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePromptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'purpose' => ['sometimes', 'nullable', 'string', 'max:255'],
            'provider_code' => ['sometimes', 'string', 'max:64'],
            'prompt_text' => ['sometimes', 'string'],
            'expected_json_schema' => ['sometimes', 'nullable', 'array'],
            'status' => ['sometimes', Rule::in([
                PromptVersion::STATUS_DRAFT,
                PromptVersion::STATUS_APPROVED,
                PromptVersion::STATUS_DEPRECATED,
            ])],
        ];
    }
}
