<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Requests;

use App\Modules\AI\Models\PromptVersion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePromptRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:128'],
            'version' => ['nullable', 'integer', 'min:1'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'provider_code' => ['required', 'string', 'max:64'],
            'prompt_text' => ['required', 'string'],
            'expected_json_schema' => ['nullable', 'array'],
            'status' => ['nullable', Rule::in([
                PromptVersion::STATUS_DRAFT,
                PromptVersion::STATUS_APPROVED,
                PromptVersion::STATUS_DEPRECATED,
            ])],
        ];
    }
}
