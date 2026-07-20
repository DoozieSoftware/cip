<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Resources;

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AiProviderConfigResource — the API representation of a provider
 * configuration. The spec is explicit (docs/09 §13): secrets MUST
 * NEVER be serialised. `credentials` is stripped from the response
 * and replaced with a `has_secret` boolean so the Super Admin can
 * see whether a key is attached without seeing the key itself.
 *
 * Header-based providers (e.g. Modal, which authenticates via
 * `Modal-Key`/`Modal-Secret`) keep their secret in `extra_headers`,
 * so sensitive header *values* are masked here too — only the header
 * names remain visible.
 *
 * @property-read AiProviderConfig $resource
 */
class AiProviderConfigResource extends JsonResource
{
    /**
     * Header names whose values are treated as secrets and masked
     * before serialisation. Matched case-insensitively as substrings.
     *
     * @var list<string>
     */
    private const SENSITIVE_HEADER_PATTERNS = [
        'key',
        'secret',
        'token',
        'authorization',
        'password',
        'api-key',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cfg = $this->resource;
        $headers = $cfg->extra_headers ?? [];

        return [
            'id' => $cfg->id,
            'code' => $cfg->code,
            'driver' => $cfg->driver,
            'name' => $cfg->name,
            'base_url' => $cfg->base_url,
            'auth_type' => $cfg->auth_type,
            'has_secret' => ! empty($cfg->credentials['api_key'] ?? null)
                || $this->hasSensitiveHeader($headers),
            'extra_headers' => $this->maskSensitiveHeaders($headers),
            'model' => $cfg->model,
            'temperature' => $cfg->temperature,
            'timeout_ms' => $cfg->timeout_ms,
            'retry_count' => $cfg->retry_count,
            'is_fallback' => $cfg->is_fallback,
            'priority' => $cfg->priority,
            'active' => $cfg->active,
            'created_at' => $cfg->created_at->toIso8601String(),
            'updated_at' => $cfg->updated_at->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $headers
     */
    private function hasSensitiveHeader(array $headers): bool
    {
        foreach (array_keys($headers) as $name) {
            if ($this->isSensitiveHeader((string) $name)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $headers
     * @return array<string, mixed>
     */
    private function maskSensitiveHeaders(array $headers): array
    {
        $masked = [];

        foreach ($headers as $name => $value) {
            $masked[$name] = $this->isSensitiveHeader((string) $name)
                ? '••••••••'
                : $value;
        }

        return $masked;
    }

    private function isSensitiveHeader(string $name): bool
    {
        $needle = strtolower($name);

        foreach (self::SENSITIVE_HEADER_PATTERNS as $pattern) {
            if (str_contains($needle, $pattern)) {
                return true;
            }
        }

        return false;
    }
}
