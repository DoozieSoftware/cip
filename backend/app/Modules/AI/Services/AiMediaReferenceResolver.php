<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Local\LocalFilesystemAdapter;
use RuntimeException;

/**
 * Builds a media reference that an external vision provider can consume.
 * Local signed URLs point at APP_URL (usually localhost in development),
 * which cloud providers cannot reach, so local evidence is embedded as a
 * data URI. S3-compatible storage continues to use a short-lived URL.
 */
class AiMediaReferenceResolver
{
    public function __construct(
        private readonly MediaUrl $mediaUrl,
    ) {}

    public function resolve(Media $media): string
    {
        $disk = Storage::disk($media->storage_disk ?: 'local');

        if (! $disk->getAdapter() instanceof LocalFilesystemAdapter) {
            return $this->mediaUrl->temporary($media);
        }

        $bytes = $disk->get($media->storage_path);

        if (! is_string($bytes) || $bytes === '') {
            throw new RuntimeException("AI evidence is unreadable: {$media->id}");
        }

        $mime = str_starts_with((string) $media->mime, 'image/')
            ? (string) $media->mime
            : 'application/octet-stream';

        return 'data:'.$mime.';base64,'.base64_encode($bytes);
    }
}
