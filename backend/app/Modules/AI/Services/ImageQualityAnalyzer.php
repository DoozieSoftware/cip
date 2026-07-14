<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\Storage;

/**
 * Heuristic image-quality scorer (0–100) for the AI vision
 * pipeline. Per docs/10 §9, we do not shell out to a CV
 * model for the first-pass quality gate — a deterministic
 * heuristic is sufficient and keeps the pipeline cheap.
 *
 * Signals (combined, weighted):
 *  - size in bytes (too small → blurry / no detail)
 *  - width × height (too few pixels → unrecognisable)
 *  - mime type (only image/* mimes are accepted; VIDEO
 *    returns a neutral 70 and DOCUMENT returns 50)
 *  - dominant pixel sample (we read the first 4 KB and
 *    compute the standard deviation of byte values; a
 *    solid-black or solid-white image has near-zero
 *    variance, a real photo has much higher variance)
 *
 * The threshold for "flag for moderator review" is
 * < 50; this constant is exposed as a class const so
 * the orchestrator and tests can reference the same
 * number.
 */
class ImageQualityAnalyzer
{
    public const FLAG_THRESHOLD = 50;

    public function score(Media $media): int
    {
        if (! str_starts_with((string) $media->mime, 'image/')) {
            return $media->type === 'VIDEO' ? 70 : 50;
        }

        $score = 100;

        // Size signal: a real citizen photo from a modern
        // phone is typically 200 KB+. Below 20 KB we
        // heavily penalise.
        $size = (int) $media->size;

        if ($size < 20_000) {
            $score -= 60;
        } elseif ($size < 80_000) {
            $score -= 25;
        } elseif ($size < 150_000) {
            $score -= 10;
        }

        // Resolution signal: under 480 px on the long edge
        // is below the threshold the spec calls out.
        $w = (int) ($media->width ?? 0);
        $h = (int) ($media->height ?? 0);
        $long = max($w, $h);

        if ($long > 0) {
            if ($long < 320) {
                $score -= 40;
            } elseif ($long < 640) {
                $score -= 20;
            } elseif ($long < 1280) {
                $score -= 5;
            }
        } else {
            // No width/height recorded at upload — minor penalty.
            $score -= 5;
        }

        // Variance signal: read up to 4 KB from the disk
        // and compute byte stdev. A solid block has stdev
        // near 0; a real photo has stdev > 30.
        $stdev = $this->byteStdev($media);

        if ($stdev < 5) {
            $score -= 40; // basically a solid block
        } elseif ($stdev < 15) {
            $score -= 20;
        } elseif ($stdev < 25) {
            $score -= 5;
        }

        $pixels = $this->pixelSignals($media);

        if ($pixels !== null) {
            if ($pixels['contrast'] < 3.0) {
                $score -= 60;
            } elseif ($pixels['contrast'] < 10.0) {
                $score -= 30;
            }

            if ($pixels['brightness'] < 20.0 || $pixels['brightness'] > 235.0) {
                $score -= 30;
            }

            if ($pixels['edge'] < 2.0) {
                $score -= 30;
            } elseif ($pixels['edge'] < 5.0) {
                $score -= 10;
            }
        }

        return max(0, min(100, $score));
    }

    public function shouldFlagForModerator(int $score): bool
    {
        return $score < self::FLAG_THRESHOLD;
    }

    private function byteStdev(Media $media): float
    {
        try {
            $disk = $media->storage_disk ?: 'local';
            $contents = Storage::disk($disk)->get($media->storage_path);
        } catch (\Throwable) {
            return 0.0;
        }

        if ($contents === null || $contents === '') {
            return 0.0;
        }

        $sample = substr($contents, 0, 4096);
        $len = strlen($sample);

        if ($len === 0) {
            return 0.0;
        }

        $sum = 0;

        for ($i = 0; $i < $len; $i++) {
            $sum += ord($sample[$i]);
        }
        $mean = $sum / $len;

        $sq = 0.0;

        for ($i = 0; $i < $len; $i++) {
            $d = ord($sample[$i]) - $mean;
            $sq += $d * $d;
        }

        return sqrt($sq / $len);
    }

    /**
     * Analyze decoded pixels rather than JPEG container bytes. The latter
     * vary even for a featureless image and cannot detect a covered lens or
     * blank upload.
     *
     * @return array{brightness: float, contrast: float, edge: float}|null
     */
    private function pixelSignals(Media $media): ?array
    {
        try {
            $bytes = Storage::disk($media->storage_disk ?: 'local')->get($media->storage_path);
        } catch (\Throwable) {
            return null;
        }

        if (! is_string($bytes) || $bytes === '' || ! function_exists('imagecreatefromstring')) {
            return null;
        }

        $source = @imagecreatefromstring($bytes);

        if ($source === false) {
            return null;
        }

        $size = 32;
        $sample = imagecreatetruecolor($size, $size);
        imagecopyresampled(
            $sample,
            $source,
            0,
            0,
            0,
            0,
            $size,
            $size,
            imagesx($source),
            imagesy($source),
        );
        $values = [];
        $sum = 0.0;
        $edgeSum = 0.0;
        $edgeCount = 0;

        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $rgb = imagecolorat($sample, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                $luminance = (0.2126 * $r) + (0.7152 * $g) + (0.0722 * $b);
                $values[$y][$x] = $luminance;
                $sum += $luminance;

                if ($x > 0) {
                    $edgeSum += abs($luminance - $values[$y][$x - 1]);
                    $edgeCount++;
                }

                if ($y > 0) {
                    $edgeSum += abs($luminance - $values[$y - 1][$x]);
                    $edgeCount++;
                }
            }
        }
        $count = $size * $size;
        $mean = $sum / $count;
        $variance = 0.0;

        foreach ($values as $row) {
            foreach ($row as $value) {
                $variance += ($value - $mean) ** 2;
            }
        }

        return [
            'brightness' => $mean,
            'contrast' => sqrt($variance / $count),
            'edge' => $edgeCount > 0 ? $edgeSum / $edgeCount : 0.0,
        ];
    }
}
