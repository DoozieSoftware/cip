<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

/**
 * Regression coverage for the Critical audit finding: nothing ever
 * built the ProviderFailoverService's $bindings array in the real
 * app container, so every real report submission threw
 * `all_providers_failed`. These tests resolve ProviderFailoverService
 * via the plain `app()` container — no manual `$this->app->bind(...)`
 * override — to prove AiServiceProvider actually wires it up.
 */
it('app() resolves a ProviderFailoverService whose bindings include every active provider row', function (): void {
    AiProviderConfig::query()->create([
        'code' => 'openrouter-prod',
        'driver' => 'openai_compatible',
        'name' => 'OpenRouter',
        'base_url' => 'https://openrouter.ai/api',
        'auth_type' => 'bearer',
        'credentials' => ['api_key' => 'sk-or-test'],
        'extra_headers' => ['HTTP-Referer' => 'https://civic-intelligence.example'],
        'model' => 'openrouter/auto',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 1,
        'is_fallback' => false,
        'priority' => 10,
        'active' => true,
    ]);

    // Disabled row must NOT be bound.
    AiProviderConfig::query()->create([
        'code' => 'inactive-provider',
        'driver' => 'openai_compatible',
        'name' => 'Inactive',
        'base_url' => 'https://example.com',
        'auth_type' => 'bearer',
        'model' => 'x',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 1,
        'is_fallback' => false,
        'priority' => 20,
        'active' => false,
    ]);

    // Force the app container to rebuild the singleton against the
    // rows just inserted (the container may have cached an empty
    // binding set from the earlier boot before this test's DB existed).
    app()->forgetInstance(ProviderFailoverService::class);
    $failover = app(ProviderFailoverService::class);

    $reflection = new ReflectionProperty(ProviderFailoverService::class, 'bindings');
    $reflection->setAccessible(true);
    $bindings = $reflection->getValue($failover);

    expect($bindings)->toHaveKey('openrouter-prod')
        ->and($bindings['openrouter-prod'])->toBeInstanceOf(OpenAICompatibleProvider::class)
        ->and($bindings)->not->toHaveKey('inactive-provider');
});

it('a report can be classified end-to-end through the real container-resolved failover service', function (): void {
    AiProviderConfig::query()->create([
        'code' => 'openrouter-prod',
        'driver' => 'openai_compatible',
        'name' => 'OpenRouter',
        'base_url' => 'https://openrouter.ai/api',
        'auth_type' => 'bearer',
        'credentials' => ['api_key' => 'sk-or-test'],
        'model' => 'openrouter/auto',
        'temperature' => 0.2,
        'timeout_ms' => 30000,
        'retry_count' => 1,
        'is_fallback' => false,
        'priority' => 10,
        'active' => true,
    ]);

    Http::fake([
        'openrouter.ai/*' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'predicted_type' => 'pothole',
                        'confidence' => 0.9,
                        'labels' => [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
                    ]),
                ],
            ]],
        ], 200),
    ]);

    app()->forgetInstance(ProviderFailoverService::class);
    $failover = app(ProviderFailoverService::class);

    $response = $failover->execute(new AiRequest(promptName: 'category_classifier', text: 'Pothole on MG Road'));

    expect($response->predictedType)->toBe('pothole')
        ->and($failover->lastUsedProvider?->code)->toBe('openrouter-prod');

    Http::assertSent(fn ($request): bool => $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
        && $request->hasHeader('Authorization', 'Bearer sk-or-test'));
});
