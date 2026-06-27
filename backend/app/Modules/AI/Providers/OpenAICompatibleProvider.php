<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * OpenAI-compatible provider — used as the base class for
 * OpenAI, Anthropic (via the OpenAI-compatible gateway),
 * Qwen-VL (T-M8-010), and any other chat-completions-
 * shaped API.
 *
 * Per docs/10 §6, the implementation calls
 *   POST {base_url}/v1/chat/completions
 * with a multi-modal message list (text + image_url per
 * URL in `mediaUrls`). The response is parsed into an
 * `AiResponse` by extracting the assistant message
 * content (JSON-encoded by the prompt's
 * `expected_json_schema` contract) and the per-label
 * confidence map.
 *
 * Errors:
 *  - 4xx/5xx with a non-2xx status → return healthCheck=false;
 *    classify() throws RuntimeException so the failover
 *    service can retry the next provider
 *  - 200 with a content body that does not parse as JSON
 *    → throw RuntimeException("invalid_ai_response")
 */
class OpenAICompatibleProvider implements AIProviderInterface
{
    public function __construct(
        private readonly string $name,
        private readonly string $model,
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly int $timeoutMs = 30000,
        private readonly ?HttpFactory $http = null,
        private readonly float $temperature = 0.2,
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
        try {
            $http = $this->http ?? Http::getFacadeRoot();
            $response = $http
                ->withToken($this->apiKey)
                ->timeout($this->timeoutMs / 1000)
                ->get(rtrim($this->baseUrl, '/').'/v1/models');

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    public function classify(AiRequest $request): AiResponse
    {
        $http = $this->http ?? Http::getFacadeRoot();

        $messages = $this->buildMessages($request);

        $response = $http
            ->withToken($this->apiKey)
            ->timeout($this->timeoutMs / 1000)
            ->post(rtrim($this->baseUrl, '/').'/v1/chat/completions', [
                'model' => $this->model,
                'temperature' => $this->temperature,
                'messages' => $messages,
                'response_format' => ['type' => 'json_object'],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(sprintf(
                'openai_compatible_error: status=%d body=%s',
                $response->status(),
                substr($response->body(), 0, 500),
            ));
        }

        $payload = $response->json();
        $content = $payload['choices'][0]['message']['content'] ?? null;

        if (! is_string($content)) {
            throw new RuntimeException('openai_compatible_error: missing message content');
        }

        $decoded = json_decode($content, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('invalid_ai_response: content is not valid JSON');
        }

        return $this->mapResponse($decoded, $payload);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildMessages(AiRequest $request): array
    {
        $userContent = [];

        if ($request->text !== '') {
            $userContent[] = ['type' => 'text', 'text' => $request->text];
        }

        foreach ($request->mediaUrls as $i => $url) {
            $userContent[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $url, 'detail' => 'auto'],
            ];
            unset($i);
        }

        return [
            ['role' => 'system', 'content' => 'You are the Civic Intelligence Platform vision engine. Respond with JSON only.'],
            ['role' => 'user', 'content' => $userContent],
        ];
    }

    /**
     * @param  array<string, mixed>  $decoded
     * @param  array<string, mixed>  $raw
     */
    private function mapResponse(array $decoded, array $raw): AiResponse
    {
        $labels = $decoded['labels'] ?? [];
        $normalized = [];

        foreach ($labels as $l) {
            $normalized[] = [
                'label' => (string) ($l['label'] ?? ''),
                'confidence' => (float) ($l['confidence'] ?? 0.0),
                'is_primary' => (bool) ($l['is_primary'] ?? false),
            ];
        }

        return new AiResponse(
            labels: $normalized,
            predictedType: (string) ($decoded['predicted_type'] ?? ''),
            confidence: (float) ($decoded['confidence'] ?? 0.0),
            recommendedDepartment: (string) ($decoded['recommended_department'] ?? ''),
            severity: (string) ($decoded['severity'] ?? 'low'),
            qualityScore: (int) ($decoded['quality_score'] ?? 0),
            duplicateScore: (int) ($decoded['duplicate_score'] ?? 0),
            fraudScore: (int) ($decoded['fraud_score'] ?? 0),
            summary: (string) ($decoded['summary'] ?? ''),
            raw: $raw,
        );
    }
}
