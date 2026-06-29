<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
use App\Modules\AI\Providers\MockProvider;
use App\Modules\AI\ValueObjects\AiRequest;

function mockFixture(): array
{
    return json_decode((string) file_get_contents(__DIR__.'/../../fixtures/ai/mock_responses.json'), true);
}

it('MockProvider reports name, model, and a healthy liveness check', function (): void {
    $p = new MockProvider(name: 'mock', model: 'mock-1.0');

    expect($p->getName())->toBe('mock')
        ->and($p->getModel())->toBe('mock-1.0')
        ->and($p->healthCheck())->toBeTrue();
});

it('returns the matching fixture entry for a known prompt_name', function (): void {
    $p = new MockProvider(responses: mockFixture());

    $resp = $p->classify(new AiRequest(promptName: 'category_classifier', text: 'Pothole on MG Road'));

    expect($resp->predictedType)->toBe('pothole')
        ->and($resp->severity)->toBe('high')
        ->and($resp->recommendedDepartment)->toBe('public_works')
        ->and($resp->primaryLabel())->toBe('pothole')
        ->and($resp->summary)->toContain('pothole');
});

it('returns the multi-label fixture for ai_labeller', function (): void {
    $p = new MockProvider(responses: mockFixture());
    $resp = $p->classify(new AiRequest(promptName: 'ai_labeller'));

    expect(count($resp->labels))->toBe(3)
        ->and($resp->primaryLabel())->toBe('pothole')
        ->and($resp->confidence)->toBeGreaterThan(0.9);
});

it('is deterministic — the same input produces the same output every call', function (): void {
    $p = new MockProvider(responses: mockFixture());
    $req = new AiRequest(promptName: 'severity_estimator');

    $a = $p->classify($req);
    $b = $p->classify($req);
    $c = $p->classify($req);

    expect($a->toArray())->toBe($b->toArray())
        ->and($b->toArray())->toBe($c->toArray());
});

it('falls back to the default fixture when prompt_name is unknown', function (): void {
    $p = new MockProvider(responses: mockFixture());

    $resp = $p->classify(new AiRequest(promptName: 'unknown_prompt_xyz'));

    expect($resp->primaryLabel())->toBe('uncategorised')
        ->and($resp->severity)->toBe('low');
});

it('falls back to an honest uncategorised response when the fixture has no default either', function (): void {
    $p = new MockProvider(responses: []);

    $resp = $p->classify(new AiRequest(promptName: 'category_classifier'));

    expect($resp->primaryLabel())->toBe('uncategorised')
        ->and($resp->confidence)->toBeLessThan(0.6)
        ->and($resp->summary)->toContain('Mock provider has no fixture');
});

it('is network-free — works without any HTTP or DB state', function (): void {
    $p = new MockProvider(responses: [
        'default' => [
            'labels' => [['label' => 'x', 'confidence' => 0.5, 'is_primary' => true]],
            'predicted_type' => 'x',
            'confidence' => 0.5,
            'recommended_department' => 'public_works',
            'severity' => 'low',
            'quality_score' => 50,
            'duplicate_score' => 0,
            'fraud_score' => 0,
            'summary' => 'x',
        ],
    ]);

    // No Http::fake() needed; classify() never touches the network.
    $resp = $p->classify(new AiRequest(
        promptName: 'category_classifier',
        mediaUrls: ['https://minio.example.com/photo.jpg'],
    ));

    expect($resp)->not->toBeNull()
        ->and($resp->raw)->toMatchArray(['mock' => true, 'prompt_name' => 'category_classifier']);
});
