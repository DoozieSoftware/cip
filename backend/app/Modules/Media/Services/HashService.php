<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use Illuminate\Http\UploadedFile;

/**
 * Computes the per-asset integrity / dedup hashes required by
 * docs/04 §9 and docs/11 §14.
 *
 *   - sha256 / sha512   : full-file cryptographic hashes;
 *                          chain-of-custody + bit-level dedup
 *   - perceptual_hash   : 16-hex-char pHash (aHash / dHash
 *                          style) for near-duplicate image
 *                          detection. Built with GD since
 *                          jenssegers/imagehash is not in the
 *                          dependency set yet (the spec allows
 *                          a fallback; the public API and the
 *                          16-char shape stay the same).
 *   - video_fingerprint: SHA-1 of a frame-byte manifest; for
 *                          M5 this is the SHA-1 of the first
 *                          32 KiB of the file. The frame-byte
 *                          manifest is upgraded in a later
 *                          release when ffmpeg is on the image.
 *
 * The service is invoked by ComputeHashesJob (T-M5-009) on the
 * queue; it is also callable synchronously from MediaService.
 */
class HashService
{
    private const VIDEO_FINGERPRINT_BYTES = 32 * 1024;

    private const PHASH_SIZE = 8; // 8x8 => 64 bits => 16 hex chars

    /**
     * @return array{
     *     sha256: string,
     *     sha512: string,
     *     perceptual_hash: string,
     *     video_fingerprint: ?string
     * }
     */
    public function compute(UploadedFile $file): array
    {
        $path = $file->getRealPath();

        if ($path === false) {
            throw new \RuntimeException('HashService: cannot resolve upload path');
        }

        $sha256 = hash_file('sha256', $path);
        $sha512 = hash_file('sha512', $path);

        $perceptual = $this->perceptualHash($path, $file->getMimeType());

        $videoFingerprint = $this->videoFingerprint($path, $file->getMimeType());

        return [
            'sha256' => (string) $sha256,
            'sha512' => (string) $sha512,
            'perceptual_hash' => $perceptual,
            'video_fingerprint' => $videoFingerprint,
        ];
    }

    private function perceptualHash(string $path, ?string $mime): string
    {
        // Only images get a pHash; for video and document
        // assets we return a 16-char zero string (the column is
        // non-nullable in the spec).
        if (! is_string($mime) || ! str_starts_with($mime, 'image/')) {
            return str_repeat('0', 16);
        }

        $gd = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/gif' => @imagecreatefromgif($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default => false,
        };

        if ($gd === false) {
            return str_repeat('0', 16);
        }

        $size = self::PHASH_SIZE;
        $resized = imagecreatetruecolor($size, $size);
        imagecopyresampled($resized, $gd, 0, 0, 0, 0, $size, $size, imagesx($gd), imagesy($gd));
        imagedestroy($gd);

        // Convert to grayscale and collect pixel values.
        $gray = [];

        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $rgb = imagecolorat($resized, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                $gray[] = (int) round(0.299 * $r + 0.587 * $g + 0.114 * $b);
            }
        }
        imagedestroy($resized);

        $mean = array_sum($gray) / count($gray);

        $bits = '';

        foreach ($gray as $v) {
            $bits .= $v >= $mean ? '1' : '0';
        }

        // Pack 64 bits into 16 hex chars.
        $hex = '';

        for ($i = 0; $i < 64; $i += 4) {
            $n = bindec(substr($bits, $i, 4));
            $hex .= dechex($n);
        }

        return str_pad($hex, 16, '0', STR_PAD_LEFT);
    }

    private function videoFingerprint(string $path, ?string $mime): ?string
    {
        if (! is_string($mime) || ! str_starts_with($mime, 'video/')) {
            return null;
        }

        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            return null;
        }

        try {
            $head = fread($handle, self::VIDEO_FINGERPRINT_BYTES);
        } finally {
            fclose($handle);
        }

        if ($head === false || $head === '') {
            return null;
        }

        return sha1($head);
    }
}
