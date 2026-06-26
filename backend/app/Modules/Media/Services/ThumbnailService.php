<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Exceptions\InvalidMediaException;
use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Thumbnail generator for the M5 evidence pipeline.
 *
 * Per docs/03 §15 the citizen PWA and the moderator portal
 * show a 320 px-wide preview in the evidence carousel. The
 * full-resolution asset stays on MinIO; the thumbnail is a
 * derived JPEG written into the same disk under
 * `<report-id>/<media-id>/thumb.jpg`.
 *
 * intervention/image is not in the dependency set yet; we use
 * the GD fallback (same pattern as HashService) so the public
 * API and the output shape stay the same. When
 * intervention/image lands, the call site does not need to
 * change.
 *
 * Acceptance: output JPEG is ≤ 50 KB. We achieve that with a
 * quality=80 baseline; the call site can request a different
 * quality via the second arg.
 */
class ThumbnailService
{
    public const THUMB_WIDTH = 320;

    public const QUALITY_DEFAULT = 80;

    /**
     * Generate a thumbnail for a stored Media row and return
     * the path inside the asset's disk.
     *
     * @throws InvalidMediaException if the asset is not an image
     * @throws RuntimeException if the underlying storage write fails
     */
    public function generate(Media $media, int $quality = self::QUALITY_DEFAULT): string
    {
        if (! in_array($media->type, ['PHOTO'], true)) {
            throw InvalidMediaException::invalidMime(
                (string) $media->type,
                'PHOTO'
            );
        }

        $disk = Storage::disk($media->storage_disk);

        if (! $disk->exists($media->storage_path)) {
            throw new RuntimeException(
                "ThumbnailService: source asset missing on disk: {$media->storage_disk}::{$media->storage_path}"
            );
        }

        $bytes = $disk->get($media->storage_path);

        if ($bytes === null) {
            throw new RuntimeException(
                "ThumbnailService: cannot read source asset: {$media->storage_path}"
            );
        }

        $source = @imagecreatefromstring($bytes);

        if ($source === false) {
            throw new RuntimeException(
                "ThumbnailService: cannot decode source image (mime={$media->mime})"
            );
        }

        $srcW = imagesx($source);
        $srcH = imagesy($source);

        if ($srcW <= 0 || $srcH <= 0) {
            imagedestroy($source);

            throw new RuntimeException('ThumbnailService: source image has zero dimensions');
        }

        $thumbH = (int) max(1, round(self::THUMB_WIDTH * $srcH / $srcW));
        $thumb = imagecreatetruecolor(self::THUMB_WIDTH, $thumbH);
        imagecopyresampled($thumb, $source, 0, 0, 0, 0, self::THUMB_WIDTH, $thumbH, $srcW, $srcH);
        imagedestroy($source);

        ob_start();
        imagejpeg($thumb, null, $quality);
        $jpeg = ob_get_clean();
        imagedestroy($thumb);

        if ($jpeg === false || $jpeg === '') {
            throw new RuntimeException('ThumbnailService: failed to encode thumbnail JPEG');
        }

        $thumbPath = $this->thumbnailPath($media);

        if (! $disk->put($thumbPath, $jpeg)) {
            throw new RuntimeException(
                "ThumbnailService: failed to write thumbnail to {$media->storage_disk}::{$thumbPath}"
            );
        }

        return $thumbPath;
    }

    /**
     * Canonical thumbnail path: <report-id>/<media-id>/thumb.jpg
     */
    public function thumbnailPath(Media $media): string
    {
        $dir = trim(dirname($media->storage_path), '/');

        if ($dir === '' || $dir === '.') {
            return $media->id.'/thumb.jpg';
        }

        return $dir.'/'.$media->id.'/thumb.jpg';
    }
}
