<?php

declare(strict_types=1);

namespace App\Modules\AI\ValueObjects;

/**
 * Provider-agnostic request to the AI vision pipeline.
 *
 * A value object — immutable, readonly properties, no
 * Eloquent coupling. The orchestrator builds one from a
 * Report + its Media and hands it to the provider.
 *
 *  - `promptName` selects the prompt slug (e.g.
 *    "category_classifier"); the provider implementation
 *    looks up the approved `prompt_versions` row
 *  - `mediaUrls` is the public/storage URLs the provider
 *    downloads (or pre-signed MinIO URLs in production);
 *    empty array for text-only classification
 *  - `mediaTypes` mirrors `mediaUrls` for providers that
 *    care (e.g. Qwen-VL needs `image/jpeg` vs
 *    `video/mp4` per-URL)
 *  - `text` is the free-form text the citizen submitted;
 *    may be empty if only media was uploaded
 *  - `metadata` is the arbitrary passthrough bag the
 *    provider's prompt may need (location, ward, district,
 *    department hints, language, etc.)
 */
final class AiRequest
{
    /**
     * @param  array<int, string>  $mediaUrls
     * @param  array<int, string>  $mediaTypes
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $promptName,
        public readonly array $mediaUrls = [],
        public readonly array $mediaTypes = [],
        public readonly string $text = '',
        public readonly array $metadata = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'prompt_name' => $this->promptName,
            'media_urls' => $this->mediaUrls,
            'media_types' => $this->mediaTypes,
            'text' => $this->text,
            'metadata' => $this->metadata,
        ];
    }
}
