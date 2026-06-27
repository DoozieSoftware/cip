<?php

declare(strict_types=1);

namespace App\Modules\AI\Contracts;

use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;

/**
 * Provider-agnostic contract every AI backend must implement.
 *
 * Per docs/10 §6, the platform supports multiple provider
 * flavours (OpenAI-compatible, Qwen-VL, Anthropic, local
 * mock). The orchestrator (T-M8-018) and the failover
 * service (T-M8-017) both depend on this interface, not on
 * concrete implementations, so a new provider can be added
 * via config alone (AiProviderConfig + a zero-code binding
 * entry in the AIProviderRegistry).
 *
 * Contract surface:
 *  - getName(): string                  — the `code` from ai_provider_configs
 *  - getModel(): string                 — the model identifier
 *  - healthCheck(): bool                — quick liveness probe
 *  - classify(AiRequest): AiResponse    — primary entry; the
 *    request carries image URLs, text, prompt version, and
 *    metadata; the response carries the structured labels,
 *    confidence, recommended department, severity, and
 *    quality/duplicate/fraud scores
 *
 * The remaining methods on the spec (analyzeImage,
 * analyzeVideo, summarize) are convenience helpers; every
 * implementation MAY delegate them to classify() with the
 * appropriate request subtype. The minimum the orchestrator
 * actually calls is classify().
 */
interface AIProviderInterface
{
    /**
     * Provider code — matches `ai_provider_configs.code`.
     */
    public function getName(): string;

    /**
     * Model identifier (e.g. "gpt-4o", "qwen-vl-plus").
     */
    public function getModel(): string;

    /**
     * Liveness probe; returns true if the upstream
     * endpoint responds (any 2xx), false otherwise. MUST
     * NOT throw — a non-200 response is a normal failure
     * mode and the caller decides whether to failover.
     */
    public function healthCheck(): bool;

    /**
     * Primary classification entry. Throws
     * ProviderUnavailableException on transport errors
     * (so the failover service can retry the next
     * provider) and InvalidAiResponseException on schema
     * violations (caller treats as a hard failure).
     */
    public function classify(AiRequest $request): AiResponse;
}
