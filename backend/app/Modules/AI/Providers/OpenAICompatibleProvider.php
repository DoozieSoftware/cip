<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\PendingRequest;
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
    /**
     * @param  array<string, string>  $extraHeaders  static headers a custom
     *                                               endpoint needs (e.g.
     *                                               OpenRouter's `HTTP-Referer`/
     *                                               `X-Title`, or a Modal.com
     *                                               deployment token header)
     */
    public function __construct(
        private readonly string $name,
        private readonly string $model,
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly int $timeoutMs = 30000,
        private readonly ?HttpFactory $http = null,
        private readonly float $temperature = 0.2,
        private readonly array $extraHeaders = [],
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
            $client = $this->authenticatedClient()->timeout($this->timeoutMs / 1000);
            $response = $client->get(rtrim($this->baseUrl, '/').'/v1/models');

            if ($response->successful()) {
                return true;
            }

            if ($response->status() === 404) {
                // Custom-deployed endpoints (e.g. Modal.com) frequently don't
                // expose an OpenAI-shaped /v1/models listing. Fall back to a
                // bare connectivity check against the base URL instead of
                // hard-failing the health check on a 404.
                return $this->authenticatedClient()
                    ->timeout($this->timeoutMs / 1000)
                    ->get(rtrim($this->baseUrl, '/'))
                    ->status() < 500;
            }

            return false;
        } catch (\Throwable) {
            return false;
        }
    }

    public function classify(AiRequest $request): AiResponse
    {
        $messages = $this->buildMessages($request);

        $response = $this->authenticatedClient()
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

        // Strip markdown code fences (```json ... ``` or ``` ... ```)
        // that some VL models wrap around JSON responses.
        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $content, $m)) {
            $content = $m[1];
        }

        $decoded = json_decode($content, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('invalid_ai_response: content is not valid JSON');
        }

        return $this->mapResponse($decoded, $payload);
    }

    private function authenticatedClient(): PendingRequest
    {
        $http = $this->http ?? Http::getFacadeRoot();

        $client = $http->withHeaders($this->extraHeaders);

        // Only send a Bearer token when an API key is configured.
        // Modal.com endpoints authenticate via `Modal-Key`/`Modal-Secret`
        // headers (passed in extraHeaders) and an empty `Authorization:
        // Bearer` header can cause some gateways to reject the request.
        if ($this->apiKey !== '') {
            $client = $client->withToken($this->apiKey);
        }

        return $client;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildMessages(AiRequest $request): array
    {
        // Resolve the prompt template from PromptVersion so the
        // model receives the full classification instructions
        // (category list, JSON schema, ANPR rules, etc.) — not
        // just the raw report text.
        $systemPrompt = 'You are the Civic Intelligence Platform vision engine. Respond with JSON only.';

        if ($request->promptName !== '') {
            $pv = PromptVersion::query()
                ->where('name', $request->promptName)
                ->orderByDesc('version')
                ->first();

            if ($pv !== null) {
                $systemPrompt = $pv->prompt_text;
            }
        }

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
            ['role' => 'system', 'content' => $systemPrompt],
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
            licensePlate: isset($decoded['license_plate']) && is_string($decoded['license_plate']) && $decoded['license_plate'] !== ''
                ? strtoupper(trim($decoded['license_plate']))
                : null,
            plateConfidence: isset($decoded['plate_confidence']) && is_numeric($decoded['plate_confidence'])
                ? (float) $decoded['plate_confidence']
                : null,
        );
    }
}
