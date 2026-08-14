<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Shared\Support\TraceContext;
use Closure;
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
        private readonly ?Closure $bearerTokenResolver = null,
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
            $response = $client->get($this->endpoint('models'));

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
            ->post($this->endpoint('chat/completions'), [
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

        $payload = $this->arrayPayload($response->json());

        if ($this->name === 'modal-vision' && $request->mediaUrls !== []) {
            $usage = $payload['usage'] ?? null;
            $processedImages = is_array($usage) ? ($usage['image_count'] ?? null) : null;
            $allEmbedded = collect($request->mediaUrls)
                ->every(static fn (string $url): bool => str_starts_with($url, 'data:image/'));

            // The currently deployed legacy Modal endpoint supports embedded
            // images but predates the explicit image_count receipt. Accept
            // only self-contained data URIs in that case; remote URLs remain
            // fail-closed because the legacy deployment silently ignored them.
            if (($processedImages === null && ! $allEmbedded)
                || ($processedImages !== null
                    && (! is_numeric($processedImages) || (int) $processedImages !== count($request->mediaUrls)))) {
                throw new RuntimeException(sprintf(
                    'vision_image_not_processed: sent=%d processed=%s',
                    count($request->mediaUrls),
                    is_scalar($processedImages) ? (string) $processedImages : 'unreported',
                ));
            }
        }

        $content = $this->messageContent($payload);

        if (! is_string($content)) {
            throw new RuntimeException('openai_compatible_error: missing message content');
        }

        // Strip markdown code fences (```json ... ``` or ``` ... ```)
        // that some VL models wrap around JSON responses.
        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $content, $m)) {
            $content = $m[1];
        }

        $decoded = $this->arrayPayload(json_decode($content, true));

        if ($decoded === []) {
            throw new RuntimeException('invalid_ai_response: content is not valid JSON');
        }

        return $this->mapResponse($decoded, $payload);
    }

    private function authenticatedClient(): PendingRequest
    {
        $client = $this->http instanceof HttpFactory
            ? $this->http->withHeaders(array_merge($this->extraHeaders, TraceContext::headers()))
            : Http::withHeaders(array_merge($this->extraHeaders, TraceContext::headers()));

        // Base64 media can push the body past 1 MB, which makes cURL attach
        // `Expect: 100-continue`. Google's AI Platform front end rejects that
        // header with HTTP 417, so disable the expect handshake entirely.
        $client = $client->withOptions(['expect' => false]);

        // Only send a Bearer token when an API key is configured.
        // Modal.com endpoints authenticate via `Modal-Key`/`Modal-Secret`
        // headers (passed in extraHeaders) and an empty `Authorization:
        // Bearer` header can cause some gateways to reject the request.
        $resolvedToken = $this->bearerTokenResolver instanceof Closure
            ? ($this->bearerTokenResolver)()
            : $this->apiKey;
        $token = is_string($resolvedToken) ? $resolvedToken : '';

        if ($token !== '') {
            $client = $client->withToken($token);
        }

        return $client;
    }

    private function endpoint(string $path): string
    {
        $baseUrl = rtrim($this->baseUrl, '/');

        if (str_ends_with($baseUrl, '/openapi')) {
            return $baseUrl.'/'.$path;
        }

        return $baseUrl.'/v1/'.$path;
    }

    /**
     * @return array<string, mixed>
     */
    private function arrayPayload(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $normalized = [];

        foreach ($payload as $key => $value) {
            if (is_string($key)) {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function messageContent(array $payload): ?string
    {
        $choices = $payload['choices'] ?? null;

        if (! is_array($choices)) {
            return null;
        }

        $firstChoice = $choices[0] ?? null;

        if (! is_array($firstChoice)) {
            return null;
        }

        $message = $firstChoice['message'] ?? null;

        if (! is_array($message)) {
            return null;
        }

        $content = $message['content'] ?? null;

        return is_string($content) ? $content : null;
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
                ->where('status', PromptVersion::STATUS_APPROVED)
                ->orderByDesc('version')
                ->first();

            if ($pv !== null) {
                $systemPrompt = $pv->prompt_text;
            }
        }

        $userContent = [];

        foreach ($request->mediaUrls as $i => $url) {
            $userContent[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $url, 'detail' => 'auto'],
            ];
            unset($i);
        }

        if ($request->text !== '') {
            $userContent[] = [
                'type' => 'text',
                'text' => "UNTRUSTED CITIZEN CLAIM (use only for consistency checking; do not use it to decide what is visible):\n".$request->text,
            ];
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

        if (! is_array($labels)) {
            $labels = [];
        }

        foreach ($labels as $l) {
            if (! is_array($l)) {
                continue;
            }

            $label = $this->arrayPayload($l);

            $normalized[] = [
                'label' => $this->stringField($label, 'label'),
                'confidence' => $this->floatField($label, 'confidence'),
                'is_primary' => $this->boolField($label, 'is_primary'),
            ];
        }

        return new AiResponse(
            labels: $normalized,
            predictedType: $this->stringField($decoded, 'predicted_type'),
            confidence: $this->floatField($decoded, 'confidence'),
            recommendedDepartment: $this->stringField($decoded, 'recommended_department'),
            severity: $this->stringField($decoded, 'severity', 'low'),
            qualityScore: $this->intField($decoded, 'quality_score'),
            duplicateScore: $this->intField($decoded, 'duplicate_score'),
            fraudScore: $this->intField($decoded, 'fraud_score'),
            summary: $this->stringField($decoded, 'summary'),
            raw: [
                'provider_payload' => $raw,
                'decoded_json' => $decoded,
            ],
            licensePlate: isset($decoded['license_plate']) && is_string($decoded['license_plate']) && $decoded['license_plate'] !== ''
                ? strtoupper(trim($decoded['license_plate']))
                : null,
            plateConfidence: isset($decoded['plate_confidence']) && is_numeric($decoded['plate_confidence'])
                ? (float) $decoded['plate_confidence']
                : null,
            claimMatchesEvidence: isset($decoded['claim_matches_evidence']) && is_bool($decoded['claim_matches_evidence'])
                ? $decoded['claim_matches_evidence']
                : null,
            consistencyScore: isset($decoded['consistency_score']) && is_numeric($decoded['consistency_score'])
                ? (int) $decoded['consistency_score']
                : null,
            mismatchReason: isset($decoded['mismatch_reason']) && is_string($decoded['mismatch_reason'])
                ? trim($decoded['mismatch_reason'])
                : null,
            syntheticScore: isset($decoded['synthetic_score']) && is_numeric($decoded['synthetic_score'])
                ? (float) $decoded['synthetic_score']
                : null,
            secondaryTriggers: is_array($decoded['secondary_triggers'] ?? null)
                ? array_values(array_filter($decoded['secondary_triggers'], 'is_string'))
                : [],
            emergencyFlag: ($decoded['emergency_flag'] ?? false) === true
                || ($decoded['emergency_flag'] ?? false) === 1
                || ($decoded['emergency_flag'] ?? false) === 'true',
        );
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function stringField(array $values, string $key, string $default = ''): string
    {
        $value = $values[$key] ?? null;

        return is_scalar($value) ? (string) $value : $default;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function floatField(array $values, string $key): float
    {
        $value = $values[$key] ?? null;

        return is_numeric($value) ? (float) $value : 0.0;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function intField(array $values, string $key): int
    {
        $value = $values[$key] ?? null;

        return is_numeric($value) ? (int) $value : 0;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function boolField(array $values, string $key): bool
    {
        return ($values[$key] ?? null) === true;
    }
}
