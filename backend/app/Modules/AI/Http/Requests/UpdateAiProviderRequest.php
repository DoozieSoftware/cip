<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Requests;

use App\Modules\AI\Support\AiProviderFactory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAiProviderRequest extends FormRequest
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
        $id = (string) $this->route('provider');

        return [
            'code' => ['sometimes', 'string', 'max:64', Rule::unique('ai_provider_configs', 'code')->ignore($id)],
            'driver' => ['sometimes', 'in:'.implode(',', [
                AiProviderFactory::DRIVER_QWEN_VL,
                AiProviderFactory::DRIVER_OPENAI_COMPATIBLE,
            ])],
            'name' => ['sometimes', 'string', 'max:255'],
            'base_url' => ['sometimes', 'url'],
            'auth_type' => ['sometimes', 'in:bearer,api_key,none'],
            'credentials' => ['nullable', 'array'],
            'credentials.api_key' => ['nullable', 'string'],
            'extra_headers' => ['nullable', 'array'],
            'extra_headers.*' => ['string'],
            'model' => ['sometimes', 'string', 'max:255'],
            'temperature' => ['sometimes', 'numeric', 'min:0', 'max:2'],
            'timeout_ms' => ['sometimes', 'integer', 'min:1000', 'max:120000'],
            'retry_count' => ['sometimes', 'integer', 'min:0', 'max:5'],
            'is_fallback' => ['sometimes', 'boolean'],
            'priority' => ['sometimes', 'integer'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
