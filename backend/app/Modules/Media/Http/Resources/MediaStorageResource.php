<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises a single `media_storage` settings row.
 *
 * The settings row holds:
 *  - disk         : "media_local" | "media_minio" | "media_s3"
 *  - region       : optional S3 region
 *  - bucket       : optional S3 bucket
 *  - endpoint     : optional S3 endpoint (MinIO uses this)
 *  - retention_days: integer; orphan rows older than this are GC'd
 *  - encryption_at_rest : boolean — instructs the storage layer to
 *                       AES-encrypt bytes (server-side encryption)
 *  - max_photo_bytes, max_video_bytes, max_document_bytes : int
 *
 * `secret` values (the S3 access key + secret) are not
 * stored in this row — they live in env / vault. This
 * resource never echoes them.
 */
class MediaStorageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed>|null $raw */
        $raw = $this->value;
        $value = is_array($raw) ? $raw : [];

        return [
            'id' => $this->id,
            'key' => $this->key,
            'disk' => (string) ($value['disk'] ?? 'media_local'),
            'region' => $value['region'] ?? null,
            'bucket' => $value['bucket'] ?? null,
            'endpoint' => $value['endpoint'] ?? null,
            'retention_days' => (int) ($value['retention_days'] ?? 0),
            'encryption_at_rest' => (bool) ($value['encryption_at_rest'] ?? false),
            'max_photo_bytes' => (int) ($value['max_photo_bytes'] ?? 0),
            'max_video_bytes' => (int) ($value['max_video_bytes'] ?? 0),
            'max_document_bytes' => (int) ($value['max_document_bytes'] ?? 0),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
