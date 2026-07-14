<?php

declare(strict_types=1);

use App\Modules\AI\Providers\OpenAICompatibleProvider;
use App\Modules\AI\ValueObjects\AiRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

function modalReceiptResponse(array $usage): array
{
    return [
        'choices' => [['message' => ['content' => json_encode([
            'labels' => [['label' => 'garbage', 'confidence' => 0.85, 'is_primary' => true]],
            'predicted_type' => 'garbage',
            'confidence' => 0.85,
            'recommended_department' => 'BBMP',
            'severity' => 'medium',
            'quality_score' => 80,
            'duplicate_score' => 0,
            'fraud_score' => 0,
            'summary' => 'Roadside garbage.',
        ])]]],
        'usage' => $usage,
    ];
}

it('accepts an embedded image from the legacy Modal endpoint without a receipt', function (): void {
    Http::fake(['modal.test/*' => Http::response(modalReceiptResponse([]), 200)]);

    $provider = new OpenAICompatibleProvider('modal-vision', 'qwen-vl', 'https://modal.test', '');
    $response = $provider->classify(new AiRequest(
        promptName: '',
        mediaUrls: ['data:image/jpeg;base64,'.base64_encode('image')],
    ));

    expect($response->predictedType)->toBe('garbage');
});

it('rejects a remote image when Modal does not acknowledge decoding it', function (): void {
    Http::fake(['modal.test/*' => Http::response(modalReceiptResponse([]), 200)]);

    $provider = new OpenAICompatibleProvider('modal-vision', 'qwen-vl', 'https://modal.test', '');

    expect(fn () => $provider->classify(new AiRequest(
        promptName: '',
        mediaUrls: ['https://storage.example.com/image.jpg'],
    )))->toThrow(RuntimeException::class, 'vision_image_not_processed');
});

it('requires the receipt count to match when Modal provides one', function (): void {
    Http::fake(['modal.test/*' => Http::response(modalReceiptResponse(['image_count' => 0]), 200)]);

    $provider = new OpenAICompatibleProvider('modal-vision', 'qwen-vl', 'https://modal.test', '');

    expect(fn () => $provider->classify(new AiRequest(
        promptName: '',
        mediaUrls: ['data:image/jpeg;base64,'.base64_encode('image')],
    )))->toThrow(RuntimeException::class, 'vision_image_not_processed');
});
