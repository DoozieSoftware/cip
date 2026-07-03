<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Requests;

use App\Modules\AI\Support\AiProviderFactory;
use Illuminate\Foundation\Http\FormRequest;

class StoreAiProviderRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:64', 'unique:ai_provider_configs,code'],
            'driver' => ['required', 'in:'.implode(',', [
                AiProviderFactory::DRIVER_QWEN_VL,
                AiProviderFactory::DRIVER_OPENAI_COMPATIBLE,
            ])],
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url'],
            'auth_type' => ['required', 'in:bearer,api_key,none'],
            'credentials' => ['nullable', 'array'],
            'credentials.api_key' => ['nullable', 'string'],
            'extra_headers' => ['nullable', 'array'],
            'extra_headers.*' => ['string'],
            'model' => ['required', 'string', 'max:255'],
            'temperature' => ['required', 'numeric', 'min:0', 'max:2'],
            'timeout_ms' => ['required', 'integer', 'min:1000', 'max:120000'],
            'retry_count' => ['required', 'integer', 'min:0', 'max:5'],
            'is_fallback' => ['required', 'boolean'],
            'priority' => ['required', 'integer'],
            'active' => ['required', 'boolean'],
        ];
    }
}
