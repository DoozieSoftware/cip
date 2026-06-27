<?php

declare(strict_types=1);

namespace App\Modules\Notifications\ValueObjects;

/**
 * Provider-agnostic delivery outcome for a single
 * notification attempt. Returned by every
 * ChannelInterface::send() implementation.
 *
 *  - `success`     — true when the channel accepted the delivery
 *  - `error`       — null on success; human-readable message on failure
 *  - `latencyMs`   — wall-clock time the channel took, in ms
 *  - `providerResponse` — raw provider payload (e.g. FCM message
 *                    id, Mailgun batch id, Twilio SID), kept for
 *                    forensic / re-prompting use
 *  - `isTransient` — true when the failure is worth retrying
 *                    (HTTP 5xx, network timeout, etc.); false
 *                    when the failure is permanent (e.g. invalid
 *                    email, mobile not in E.164)
 */
final class ChannelResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?string $error = null,
        public readonly ?int $latencyMs = null,
        public readonly array $providerResponse = [],
        public readonly bool $isTransient = true,
    ) {}

    public static function ok(int $latencyMs, array $providerResponse = []): self
    {
        return new self(success: true, latencyMs: $latencyMs, providerResponse: $providerResponse);
    }

    public static function fail(string $error, bool $transient = true, ?int $latencyMs = null, array $providerResponse = []): self
    {
        return new self(
            success: false,
            error: $error,
            latencyMs: $latencyMs,
            providerResponse: $providerResponse,
            isTransient: $transient,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'error' => $this->error,
            'latency_ms' => $this->latencyMs,
            'provider_response' => $this->providerResponse,
            'is_transient' => $this->isTransient,
        ];
    }
}
