<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;

/**
 * Deterministic, fixture-driven mock AI provider.
 *
 * Per docs/10 §6, this provider is the default in dev/test.
 * It is selected by `code = "mock"` and the orchestrator
 * prefers it over real providers when `APP_ENV` is local or
 * testing.
 *
 * Behaviour:
 *  - getName() / getModel() read from constructor args
 *  - healthCheck() always returns true
 *  - classify() looks up the response by `promptName` in the
 *    fixture file (or falls back to the `default` entry).
 *    No HTTP, no randomness — the same input always
 *    produces the same response, which is what the
 *    benchmark suite (T-M8-028) and the
 *    ProviderFailoverService tests depend on.
 *
 * The fixture file path is configurable so the test suite
 * can swap in a tiny stub fixture while production points
 * at a richer one.
 */
class MockProvider implements AIProviderInterface
{
    /**
     * @param  array<string, array<string, mixed>>  $responses  keyed by prompt_name
     */
    public function __construct(
        private readonly string $name = 'mock',
        private readonly string $model = 'mock-1.0',
        private readonly array $responses = [],
    ) {}

    public function getName(): string
    {
        return $this->name;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function healthCheck(): bool
    {
        return true;
    }

    public function classify(AiRequest $request): AiResponse
    {
        $row = $this->responses[$request->promptName] ?? $this->responses['default'] ?? null;

        if ($row === null) {
            // Honest mock default: a single low-confidence
            // "uncategorised" label so the orchestrator can
            // still write a result row and continue the
            // pipeline (which will then route to moderator
            // per the ConfidenceAggregator rules).
            return new AiResponse(
                labels: [['label' => 'uncategorised', 'confidence' => 0.50, 'is_primary' => true]],
                predictedType: 'uncategorised',
                confidence: 0.50,
                recommendedDepartment: '',
                severity: 'low',
                qualityScore: 50,
                duplicateScore: 0,
                fraudScore: 0,
                summary: 'Mock provider has no fixture for prompt "'.$request->promptName.'".',
            );
        }

        return new AiResponse(
            labels: $row['labels'] ?? [['label' => 'pothole', 'confidence' => 0.85, 'is_primary' => true]],
            predictedType: (string) ($row['predicted_type'] ?? 'pothole'),
            confidence: (float) ($row['confidence'] ?? 0.85),
            recommendedDepartment: (string) ($row['recommended_department'] ?? 'public_works'),
            severity: (string) ($row['severity'] ?? 'medium'),
            qualityScore: (int) ($row['quality_score'] ?? 80),
            duplicateScore: (int) ($row['duplicate_score'] ?? 0),
            fraudScore: (int) ($row['fraud_score'] ?? 0),
            summary: (string) ($row['summary'] ?? 'Mock classification'),
            raw: ['mock' => true, 'prompt_name' => $request->promptName],
        );
    }
}
