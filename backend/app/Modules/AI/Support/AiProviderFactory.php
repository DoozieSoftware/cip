<?php

declare(strict_types=1);

namespace App\Modules\AI\Support;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\Providers\QwenVLProvider;
use RuntimeException;

/**
 * Builds the concrete `AIProviderInterface` implementation for an
 * `ai_provider_configs` row.
 *
 * `driver` selects the implementation; `openai_compatible` is the
 * generic driver that covers any OpenAI-chat-completions-shaped API,
 * including OpenRouter and a custom-deployed Modal.com endpoint —
 * pointing a row at either is just a matter of setting `base_url`,
 * `credentials.api_key`, and (for OpenRouter) `extra_headers`.
 */
class AiProviderFactory
{
    public const DRIVER_QWEN_VL = 'qwen_vl';

    public const DRIVER_OPENAI_COMPATIBLE = 'openai_compatible';

    public function make(AiProviderConfig $cfg): AIProviderInterface
    {
        return match ($cfg->driver) {
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
                bearerTokenResolver: $this->bearerTokenResolver($cfg),
            ),
            default => throw new RuntimeException("ai.provider.unknown_driver: {$cfg->driver}"),
        };
    }

    private function apiKey(AiProviderConfig $cfg): string
    {
        return $this->stringCredential($cfg, 'api_key');
    }

    private function bearerTokenResolver(AiProviderConfig $cfg): ?\Closure
    {
        if ($cfg->auth_type !== 'oauth_service_account') {
            return null;
        }

        $provider = new GoogleServiceAccountTokenProvider(
            credentialsPath: $this->stringCredential($cfg, 'service_account_path'),
        );

        return static fn (): string => $provider->token();
    }

    private function stringCredential(AiProviderConfig $cfg, string $key): string
    {
        $credentials = $cfg->credentials;
        $value = is_array($credentials) ? ($credentials[$key] ?? null) : null;

        return is_string($value) ? $value : '';
    }
}
