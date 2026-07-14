<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
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
        $content = $request['messages'][1]['content'];

        return $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer sk-test')
            && $request['model'] === 'gpt-4o'
            && $request['response_format'] === ['type' => 'json_object']
            && $content[0]['type'] === 'image_url'
            && $content[1]['type'] === 'text'
            && str_contains($content[1]['text'], 'UNTRUSTED CITIZEN CLAIM');
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

it('rejects a Modal vision response that does not prove it decoded the supplied image', function (): void {
    Http::fake([
        'my-model.modal.run/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'labels' => [['label' => 'pothole', 'confidence' => 0.95, 'is_primary' => true]],
                'predicted_type' => 'pothole',
                'confidence' => 0.95,
                'recommended_department' => 'BBMP',
                'severity' => 'high',
                'quality_score' => 90,
                'duplicate_score' => 0,
                'fraud_score' => 0,
                'summary' => 'Pothole.',
            ])]]],
            'usage' => ['prompt_tokens' => 100],
        ], 200),
    ]);

    $provider = new OpenAICompatibleProvider(
        name: 'modal-vision',
        model: 'qwen-vl',
        baseUrl: 'https://my-model.modal.run',
        apiKey: '',
    );

    expect(fn () => $provider->classify(new AiRequest(
        promptName: 'category_classifier',
        mediaUrls: ['https://storage.example.com/image.jpg'],
    )))->toThrow(RuntimeException::class, 'vision_image_not_processed');
});

it('accepts and maps Modal evidence consistency when every image is acknowledged', function (): void {
    Http::fake([
        'my-model.modal.run/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => json_encode([
                'labels' => [['label' => 'garbage', 'confidence' => 0.88, 'is_primary' => true]],
                'predicted_type' => 'garbage',
                'confidence' => 0.88,
                'recommended_department' => 'BBMP',
                'severity' => 'medium',
                'quality_score' => 82,
                'duplicate_score' => 0,
                'fraud_score' => 5,
                'summary' => 'Visible roadside garbage.',
                'claim_matches_evidence' => false,
                'consistency_score' => 10,
                'mismatch_reason' => 'The claim says pothole but the image shows garbage.',
                'synthetic_score' => 0.03,
            ])]]],
            'usage' => ['image_count' => 1],
        ], 200),
    ]);

    $provider = new OpenAICompatibleProvider(
        name: 'modal-vision',
        model: 'qwen-vl',
        baseUrl: 'https://my-model.modal.run',
        apiKey: '',
    );
    $response = $provider->classify(new AiRequest(
        promptName: 'category_classifier',
        mediaUrls: ['data:image/jpeg;base64,'.base64_encode('image')],
    ));

    expect($response->predictedType)->toBe('garbage')
        ->and($response->claimMatchesEvidence)->toBeFalse()
        ->and($response->consistencyScore)->toBe(10)
        ->and($response->syntheticScore)->toBe(0.03);
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

it('sends extra_headers on both healthCheck and classify (OpenRouter-style custom headers)', function (): void {
    Http::fake([
        'openrouter.ai/*' => Http::response([
            'choices' => [['message' => ['content' => json_encode(['predicted_type' => 'pothole'])]]],
        ], 200),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'openrouter',
        model: 'openrouter/auto',
        baseUrl: 'https://openrouter.ai/api',
        apiKey: 'sk-or-test',
        extraHeaders: ['HTTP-Referer' => 'https://civic-intelligence.example', 'X-Title' => 'Civic Intelligence Platform'],
    );

    $p->healthCheck();
    $p->classify(new AiRequest(promptName: 'category_classifier'));

    Http::assertSent(function ($request): bool {
        return $request->hasHeader('HTTP-Referer', 'https://civic-intelligence.example')
            && $request->hasHeader('X-Title', 'Civic Intelligence Platform')
            && $request->hasHeader('Authorization', 'Bearer sk-or-test');
    });
});

it('healthCheck falls back to a bare connectivity check when /v1/models 404s (Modal.com-style deployments)', function (): void {
    Http::fake([
        'my-model.modal.run/v1/models' => Http::response(['error' => 'not found'], 404),
        'my-model.modal.run' => Http::response('ok', 200),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'modal-vision',
        model: 'custom-vision-1',
        baseUrl: 'https://my-model.modal.run',
        apiKey: 'modal-token',
    );

    expect($p->healthCheck())->toBeTrue();
});

it('healthCheck returns false when both /v1/models and the bare base URL fail', function (): void {
    Http::fake([
        'my-model.modal.run/v1/models' => Http::response(['error' => 'not found'], 404),
        'my-model.modal.run' => Http::response('down', 500),
    ]);

    $p = new OpenAICompatibleProvider(
        name: 'modal-vision',
        model: 'custom-vision-1',
        baseUrl: 'https://my-model.modal.run',
        apiKey: 'modal-token',
    );

    expect($p->healthCheck())->toBeFalse();
});
