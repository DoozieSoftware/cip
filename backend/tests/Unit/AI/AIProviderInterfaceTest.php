<?php

declare(strict_types=1);

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;

it('declares the four required methods every provider must implement', function (): void {
    $reflection = new ReflectionClass(AIProviderInterface::class);
    $methods = array_map(fn (ReflectionMethod $m) => $m->getName(), $reflection->getMethods());

    expect($methods)->toContain('getName')
        ->and($methods)->toContain('getModel')
        ->and($methods)->toContain('healthCheck')
        ->and($methods)->toContain('classify');
});

it('returns the primary label when one is flagged is_primary', function (): void {
    $resp = new AiResponse(
        labels: [
            ['label' => 'pothole', 'confidence' => 0.7, 'is_primary' => false],
            ['label' => 'road_damage', 'confidence' => 0.9, 'is_primary' => true],
        ],
        predictedType: 'road_damage',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 85,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'A large pothole',
    );

    expect($resp->primaryLabel())->toBe('road_damage');
});

it('falls back to highest confidence when no is_primary is set', function (): void {
    $resp = new AiResponse(
        labels: [
            ['label' => 'pothole', 'confidence' => 0.6, 'is_primary' => false],
            ['label' => 'road_damage', 'confidence' => 0.9, 'is_primary' => false],
        ],
        predictedType: 'road_damage',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 85,
        duplicateScore: 0,
        fraudScore: 0,
        summary: 'x',
    );

    expect($resp->primaryLabel())->toBe('road_damage');
});

it('returns null primaryLabel when labels array is empty', function (): void {
    $resp = new AiResponse(
        labels: [],
        predictedType: '',
        confidence: 0.0,
        recommendedDepartment: '',
        severity: 'low',
        qualityScore: 0,
        duplicateScore: 0,
        fraudScore: 0,
        summary: '',
    );

    expect($resp->primaryLabel())->toBeNull();
});

it('AiRequest is a readonly value object and roundtrips via toArray', function (): void {
    $req = new AiRequest(
        promptName: 'category_classifier',
        mediaUrls: ['https://minio.example.com/reports/abc/photo.jpg'],
        mediaTypes: ['image/jpeg'],
        text: 'Large pothole on MG Road',
        metadata: ['ward' => 'mg-road', 'language' => 'en'],
    );

    expect($req->toArray())->toBe([
        'prompt_name' => 'category_classifier',
        'media_urls' => ['https://minio.example.com/reports/abc/photo.jpg'],
        'media_types' => ['image/jpeg'],
        'text' => 'Large pothole on MG Road',
        'metadata' => ['ward' => 'mg-road', 'language' => 'en'],
    ]);
});

it('AiResponse is a readonly value object and roundtrips via toArray', function (): void {
    $resp = new AiResponse(
        labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
        predictedType: 'pothole',
        confidence: 0.9,
        recommendedDepartment: 'public_works',
        severity: 'high',
        qualityScore: 88,
        duplicateScore: 0,
        fraudScore: 2,
        summary: 'Pothole on the right lane.',
        raw: ['id' => 'chatcmpl-abc'],
    );

    $arr = $resp->toArray();
    expect($arr['predicted_type'])->toBe('pothole')
        ->and($arr['confidence'])->toBe(0.9)
        ->and($arr['quality_score'])->toBe(88)
        ->and($arr['raw'])->toBe(['id' => 'chatcmpl-abc']);
});

it('a concrete implementation can be type-checked against AIProviderInterface', function (): void {
    $stub = new class implements AIProviderInterface
    {
        public function getName(): string
        {
            return 'stub';
        }

        public function getModel(): string
        {
            return 'stub-model';
        }

        public function healthCheck(): bool
        {
            return true;
        }

        public function classify(AiRequest $request): AiResponse
        {
            return new AiResponse(
                labels: [['label' => 'stub', 'confidence' => 1.0, 'is_primary' => true]],
                predictedType: 'stub',
                confidence: 1.0,
                recommendedDepartment: 'public_works',
                severity: 'low',
                qualityScore: 100,
                duplicateScore: 0,
                fraudScore: 0,
                summary: 'stub',
            );
        }
    };

    expect($stub)->toBeInstanceOf(AIProviderInterface::class)
        ->and($stub->getName())->toBe('stub')
        ->and($stub->getModel())->toBe('stub-model')
        ->and($stub->healthCheck())->toBeTrue();

    $resp = $stub->classify(new AiRequest(promptName: 'category_classifier'));
    expect($resp->primaryLabel())->toBe('stub');
});
