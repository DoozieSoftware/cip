<?php

declare(strict_types=1);

namespace App\Modules\AI\Support;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Providers\MockProvider;
use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\Providers\QwenVLProvider;
use RuntimeException;

/**
 * Builds the concrete `AIProviderInterface` implementation for an
 * `ai_provider_configs` row. This is the piece that was missing
 * entirely before the post-audit remediation: `ProviderFailoverService`
 * could read config rows but nothing ever turned a row into a callable
 * provider instance, so real classification never happened in
 * production (`AiServiceProvider` calls this class at boot to build the
 * failover bindings).
 *
 * `driver` selects the implementation; `openai_compatible` is the
 * generic driver that covers any OpenAI-chat-completions-shaped API,
 * including OpenRouter and a custom-deployed Modal.com endpoint —
 * pointing a row at either is just a matter of setting `base_url`,
 * `credentials.api_key`, and (for OpenRouter) `extra_headers`.
 */
class AiProviderFactory
{
    public const DRIVER_MOCK = 'mock';

    public const DRIVER_QWEN_VL = 'qwen_vl';

    public const DRIVER_OPENAI_COMPATIBLE = 'openai_compatible';

    public function make(AiProviderConfig $cfg): AIProviderInterface
    {
        return match ($cfg->driver) {
            self::DRIVER_MOCK => new MockProvider(
                name: $cfg->code,
                model: $cfg->model,
            ),
            self::DRIVER_QWEN_VL => new QwenVLProvider(
                apiKey: $this->apiKey($cfg),
                timeoutMs: $cfg->timeout_ms,
            ),
            self::DRIVER_OPENAI_COMPATIBLE => new OpenAICompatibleProvider(
                name: $cfg->code,
                model: $cfg->model,
                baseUrl: $cfg->base_url,
                apiKey: $this->apiKey($cfg),
                timeoutMs: $cfg->timeout_ms,
                temperature: $cfg->temperature,
                extraHeaders: $cfg->extra_headers ?? [],
            ),
            default => throw new RuntimeException("ai.provider.unknown_driver: {$cfg->driver}"),
        };
    }

    private function apiKey(AiProviderConfig $cfg): string
    {
        return (string) ($cfg->credentials['api_key'] ?? '');
    }
}
