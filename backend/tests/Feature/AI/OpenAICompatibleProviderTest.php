<?php

declare(strict_types=1);

use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\ValueObjects\AiRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

it('returns name and model exactly as constructed', function (): void {
    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    expect($p->getName())->toBe('openai')
        ->and($p->getModel())->toBe('gpt-4o');
});

it('healthCheck returns true on a 2xx GET /v1/models', function (): void {
    Http::fake([
        'api.openai.com/*' => Http::response(['data' => [['id' => 'gpt-4o']]], 200),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    expect($p->healthCheck())->toBeTrue();
});

it('healthCheck returns false on a 4xx', function (): void {
    Http::fake([
        'api.openai.com/*' => Http::response(['error' => 'unauthorized'], 401),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-bad',
    );

    expect($p->healthCheck())->toBeFalse();
});

it('healthCheck returns false on a transport error (no throw)', function (): void {
    Http::fake([
        'api.openai.com/*' => function (): void {
            throw new ConnectionException('boom');
        },
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    expect($p->healthCheck())->toBeFalse();
});

it('classify() posts to /v1/chat/completions with bearer auth and parses the JSON content', function (): void {
    Http::fake([
        'api.openai.com/v1/chat/completions' => Http::response([
            'id' => 'chatcmpl-abc',
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'labels' => [
                            ['label' => 'pothole', 'confidence' => 0.92, 'is_primary' => true],
                            ['label' => 'road_damage', 'confidence' => 0.71, 'is_primary' => false],
                        ],
                        'predicted_type' => 'pothole',
                        'confidence' => 0.92,
                        'recommended_department' => 'public_works',
                        'severity' => 'high',
                        'quality_score' => 88,
                        'duplicate_score' => 0,
                        'fraud_score' => 2,
                        'summary' => 'Large pothole on MG Road.',
                    ]),
                ],
            ]],
            'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 50],
        ], 200),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    $resp = $p->classify(new AiRequest(
        promptName: 'category_classifier',
        text: 'Pothole on MG Road',
        mediaUrls: ['https://minio.example.com/photo.jpg'],
    ));

    expect($resp->predictedType)->toBe('pothole')
        ->and($resp->severity)->toBe('high')
        ->and($resp->primaryLabel())->toBe('pothole')
        ->and($resp->raw['usage'])->toBe(['prompt_tokens' => 100, 'completion_tokens' => 50]);

    Http::assertSent(function ($request): bool {
        return $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer sk-test')
            && $request['model'] === 'gpt-4o'
            && $request['response_format'] === ['type' => 'json_object'];
    });
});

it('classify() throws on a 5xx so the failover service can retry', function (): void {
    Http::fake([
        'api.openai.com/v1/chat/completions' => Http::response(['error' => 'overloaded'], 503),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    expect(fn () => $p->classify(new AiRequest(promptName: 'category_classifier')))
        ->toThrow(RuntimeException::class);
});

it('classify() throws on non-JSON content (defensive against prompt drift)', function (): void {
    Http::fake([
        'api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'I cannot help with that.']]],
        ], 200),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
    );

    expect(fn () => $p->classify(new AiRequest(promptName: 'category_classifier')))
        ->toThrow(RuntimeException::class, 'invalid_ai_response');
});
