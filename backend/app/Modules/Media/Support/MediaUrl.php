<?php

declare(strict_types=1);

namespace App\Modules\Media\Support;

use App\Modules\Media\Models\Media;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Filesystem\LocalFilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * MediaUrl — the M5 helper for building time-limited download
 * URLs for Media rows.
 *
 * Two backends are supported:
 *
 *  1. Storage::temporaryUrl(\$disk, \$path, \$ttl)
 *     The native S3 / MinIO presigned-URL API. Used in
 *     production when the storage driver is AWS S3 (the same
 *     adapter is used for MinIO and Cloudflare R2). The
 *     presigned URL is signed by the storage driver and is
 *     verified by the storage endpoint itself — the app does
 *     not need to be in the request path.
 *
 *  2. URL::temporarySignedRoute(api.v1.media.serve, \$ttl, ...)
 *     The Laravel-side fallback. The route streams the file
 *     from the configured disk through the app. Used for the
 *     local disk in dev and tests, and as a defensive
 *     fallback for any disk whose native temporaryUrl is
 *     misconfigured.
 *
 * The local filesystem's `temporaryUrl` always points at a
 * `storage.{disk}` route that the framework only registers
 * when `php artisan storage:link` has been run. Our app
 * deliberately does not expose that route — the media bytes
 * are sensitive (chain-of-custody §15) and must be served
 * through the signed `api.v1.media.serve` route which
 * records a DOWNLOAD row. So we force the local disk to use
 * the Laravel-side signed route.
 */
class MediaUrl
{
    public const DEFAULT_TTL_MINUTES = 15;

    public function temporary(Media $media, int $ttlMinutes = self::DEFAULT_TTL_MINUTES): string
    {
        $expiresAt = now()->addMinutes($ttlMinutes);

        $disk = Storage::disk($media->storage_disk);
        $adapter = $disk->getAdapter();

        // Only the AWS S3 adapter (covers S3 / MinIO / R2)
        // gives a real presigned URL that the storage layer
        // verifies. Everything else uses the Laravel-side
        // signed route.
        if ($adapter instanceof AwsS3V3Adapter
            && method_exists($disk, 'temporaryUrl')) {
            return $disk->temporaryUrl($media->storage_path, $expiresAt);
        }

        // Local + everything-else fallback: signed route to
        // our controller. (Defensive: LocalFilesystemAdapter
        // implements temporaryUrl, but its output points at
        // a non-existent `storage.local` route.)
        return URL::temporarySignedRoute(
            'api.v1.media.serve',
            $expiresAt,
            ['media' => $media->id],
        );
    }
}
