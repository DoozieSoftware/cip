<?php

declare(strict_types=1);

namespace App\Modules\Media\Support;

use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * MediaUrl — the M5 helper for building time-limited download
 * URLs for Media rows.
 *
 * Two backends are supported:
 *
 *  1. Storage::temporaryUrl(\$disk, \$path, \$ttl)
 *     The native Laravel/S3/MinIO presigned-URL API. Used in
 *     production when the storage disk implements
 *     `Illuminate\Filesystem\FilesystemAdapter::temporaryUrl`
 *     (the league/flysystem-s3-v3 + MinIO bridge do). The
 *     presigned URL is signed by the storage driver and can
 *     be verified by issuing a HEAD/GET against the storage
 *     endpoint directly.
 *
 *  2. URL::temporarySignedRoute(api.v1.media.serve, \$ttl, ...)
 *     The Laravel-side fallback. The route streams the file
 *     from the configured disk through the app. Used in dev
 *     and in tests where Storage::temporaryUrl is not
 *     implemented.
 *
 * The helper picks the best backend based on what the disk
 * supports and is unit-testable: the returned URL must
 * verify against Laravel signed-route middleware so callers
 * can rely on a single contract.
 */
class MediaUrl
{
    public const DEFAULT_TTL_MINUTES = 15;

    public function temporary(Media $media, int $ttlMinutes = self::DEFAULT_TTL_MINUTES): string
    {
        $expiresAt = now()->addMinutes($ttlMinutes);

        $disk = Storage::disk($media->storage_disk);

        if (method_exists($disk, 'temporaryUrl')) {
            try {
                return $disk->temporaryUrl($media->storage_path, $expiresAt);
            } catch (\Throwable) {
                // fall through to the Laravel-side signed route
            }
        }

        return URL::temporarySignedRoute(
            'api.v1.media.serve',
            $expiresAt,
            ['media' => $media->id],
        );
    }
}
