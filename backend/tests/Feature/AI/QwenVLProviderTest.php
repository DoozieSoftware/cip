<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
use App\Modules\AI\Providers\QwenVLProvider;
use App\Modules\AI\ValueObjects\AiRequest;
use Illuminate\Support\Facades\Http;

it('exposes the qwen-vl code, qwen-vl-plus model, and the DashScope base URL by default', function (): void {
    $p = new QwenVLProvider;

    expect($p->getName())->toBe('qwen-vl')
        ->and($p->getModel())->toBe('qwen-vl-plus')
        ->and(QwenVLProvider::CODE)->toBe('qwen-vl')
        ->and(QwenVLProvider::DEFAULT_MODEL)->toBe('qwen-vl-plus')
        ->and(QwenVLProvider::DEFAULT_BASE_URL)->toBe('https://dashscope.aliyuncs.com')
        ->and(QwenVLProvider::DEFAULT_TEMPERATURE)->toBe(0.2);
});

it('is selected by code=qwen-vl (matches the provider config code)', function (): void {
    expect(QwenVLProvider::CODE)->toBe('qwen-vl');
});

it('healthCheck hits the DashScope /v1/models endpoint with the bearer token', function (): void {
    Http::fake([
        'dashscope.aliyuncs.com/v1/models' => Http::response(['data' => []], 200),
    ]);

    $p = new QwenVLProvider(apiKey: 'sk-dashscope-test');
    expect($p->healthCheck())->toBeTrue();

    Http::assertSent(fn ($r) => $r->url() === 'https://dashscope.aliyuncs.com/v1/models'
        && $r->hasHeader('Authorization', 'Bearer sk-dashscope-test'));
});

it('healthCheck returns false on a 4xx', function (): void {
    Http::fake([
        'dashscope.aliyuncs.com/*' => Http::response(['error' => 'unauthorized'], 401),
    ]);

    expect((new QwenVLProvider(apiKey: 'sk-bad'))->healthCheck())->toBeFalse();
});

it('classify() POSTs to the DashScope /v1/chat/completions endpoint with qwen-vl-plus model', function (): void {
    Http::fake([
        'dashscope.aliyuncs.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'labels' => [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
                        'predicted_type' => 'pothole',
                        'confidence' => 0.9,
                        'recommended_department' => 'public_works',
                        'severity' => 'high',
                        'quality_score' => 80,
                        'duplicate_score' => 0,
                        'fraud_score' => 0,
                        'summary' => 'x',
                    ]),
                ],
            ]],
        ], 200),
    ]);

    $p = new QwenVLProvider(apiKey: 'sk-dashscope-test');
    $resp = $p->classify(new AiRequest(
        promptName: 'category_classifier',
        text: 'Pothole',
    ));

    expect($resp->predictedType)->toBe('pothole')
        ->and($resp->primaryLabel())->toBe('pothole');

    Http::assertSent(fn ($r) => $r->url() === 'https://dashscope.aliyuncs.com/v1/chat/completions'
        && $r['model'] === 'qwen-vl-plus'
        && (float) $r['temperature'] === 0.2);
});
