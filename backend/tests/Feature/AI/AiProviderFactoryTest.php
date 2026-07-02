<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Providers\MockProvider;
use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\Providers\QwenVLProvider;
use App\Modules\AI\Support\AiProviderFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @param  array<string, mixed>  $overrides
 */
function makeAiProviderConfig(array $overrides = []): AiProviderConfig
{
    return AiProviderConfig::query()->make(array_merge([
        'code' => 'test-provider',
        'driver' => 'openai_compatible',
        'name' => 'Test Provider',
        'base_url' => 'https://api.example.com',
        'auth_type' => 'bearer',
        'credentials' => null,
        'extra_headers' => null,
        'model' => 'test-model',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 2,
        'is_fallback' => false,
        'priority' => 100,
        'active' => true,
    ], $overrides));
}

it('builds a MockProvider for the mock driver', function (): void {
    $cfg = makeAiProviderConfig(['driver' => 'mock', 'code' => 'mock', 'model' => 'mock-1.0']);

    $provider = (new AiProviderFactory)->make($cfg);

    expect($provider)->toBeInstanceOf(MockProvider::class)
        ->and($provider->getName())->toBe('mock')
        ->and($provider->getModel())->toBe('mock-1.0');
});

it('builds a QwenVLProvider for the qwen_vl driver, reading the credentials api_key', function (): void {
    $cfg = makeAiProviderConfig([
        'driver' => 'qwen_vl',
        'code' => 'qwen-vl',
        'credentials' => ['api_key' => 'dashscope-secret'],
    ]);

    $provider = (new AiProviderFactory)->make($cfg);

    expect($provider)->toBeInstanceOf(QwenVLProvider::class)
        ->and($provider->getName())->toBe(QwenVLProvider::CODE);
});

it('builds an OpenAICompatibleProvider for the openai_compatible driver, wired to a custom base_url and extra_headers (OpenRouter/Modal.com)', function (): void {
    $cfg = makeAiProviderConfig([
        'driver' => 'openai_compatible',
        'code' => 'openrouter',
        'name' => 'OpenRouter',
        'base_url' => 'https://openrouter.ai/api',
        'model' => 'openrouter/auto',
        'credentials' => ['api_key' => 'sk-or-secret'],
        'extra_headers' => ['HTTP-Referer' => 'https://civic-intelligence.example'],
    ]);

    $provider = (new AiProviderFactory)->make($cfg);

    expect($provider)->toBeInstanceOf(OpenAICompatibleProvider::class)
        ->and($provider->getName())->toBe('openrouter')
        ->and($provider->getModel())->toBe('openrouter/auto');
});

it('throws on an unknown driver rather than silently returning null', function (): void {
    $cfg = makeAiProviderConfig(['driver' => 'not_a_real_driver']);

    expect(fn () => (new AiProviderFactory)->make($cfg))
        ->toThrow(RuntimeException::class, 'ai.provider.unknown_driver');
});

it('defaults to an empty api key when credentials is null (mock/none-auth providers)', function (): void {
    $cfg = makeAiProviderConfig([
        'driver' => 'openai_compatible',
        'code' => 'no-secret',
        'credentials' => null,
    ]);

    $provider = (new AiProviderFactory)->make($cfg);

    expect($provider)->toBeInstanceOf(OpenAICompatibleProvider::class);
});
