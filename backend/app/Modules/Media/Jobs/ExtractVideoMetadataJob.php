<?php

declare(strict_types=1);

namespace App\Modules\Media\Jobs;

use App\Modules\Media\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Extracts video metadata via `ffprobe` and writes it back to
 * the Media row. Per docs/05 §14 the citizen's upload
 * endpoint accepts the asset as soon as it lands on MinIO; the
 * full resolution, frame rate, duration etc. are derived
 * asynchronously here so the citizen's submit request is not
 * blocked on ffprobe.
 *
 * ffprobe is not always present in dev / CI / V1 single-node
 * deployments. When the binary is missing the job falls back
 * to the metadata that was passed at upload time (via
 * `metadata.uploaded_dimensions` and `metadata.uploaded_duration`)
 * so the row still ends up with sensible defaults.
 *
 * Per docs/14 §16 the job retries 3 times with a 30s backoff
 * and dead-letters on the fourth failure.
 */
class ExtractVideoMetadataJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /**
     * @param  string  $ffprobeBinary  the path to ffprobe. Default
     *                                 'ffprobe' (resolved via PATH).
     *                                 Injected by the test so we
     *                                 can stub the call.
     */
    public function __construct(
        public readonly string $mediaId,
        private readonly string $ffprobeBinary = 'ffprobe',
    ) {
        $this->onQueue('media');
    }

    public function handle(): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null) {
            Log::info('media.video_metadata.skipped_missing_media', [
                'media_id' => $this->mediaId,
            ]);

            return;
        }

        if ($media->type !== 'VIDEO') {
            // Nothing to do for non-video assets.
            return;
        }

        try {
            $meta = $this->probeOrFallback($media);
        } catch (Throwable $e) {
            Log::warning('media.video_metadata.failed', [
                'media_id' => $this->mediaId,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        $media->duration = $meta['duration'];
        $media->width = $meta['width'];
        $media->height = $meta['height'];
        $media->save();
    }

    public function failed(Throwable $e): void
    {
        Log::error('media.video_metadata.dlq', [
            'media_id' => $this->mediaId,
            'tries' => $this->tries,
            'error' => $e->getMessage(),
        ]);
    }

    /**
     * @return list<string>
     */
    public function tags(): array
    {
        return ['media', 'media.video_metadata', 'media:'.$this->mediaId];
    }

    /**
     * @return array{duration: int|null, width: int|null, height: int|null}
     */
    private function probeOrFallback(Media $media): array
    {
        $disk = Storage::disk($media->storage_disk);
        $path = $disk->path($media->storage_path);

        if (! is_file($path)) {
            throw new RuntimeException(
                "ExtractVideoMetadataJob: source asset missing on disk: {$media->storage_disk}::{$media->storage_path}"
            );
        }

        $binary = $this->ffprobeBinary;
        $command = escapeshellcmd($binary)
            .' -v error -select_streams v:0'
            .' -show_entries stream=width,height,duration'
            .' -of default=noprint_wrappers=1:nokey=1 '
            .escapeshellarg($path);
        $output = [];
        $exit = 1;
        @exec($command, $output, $exit);

        if ($exit === 0 && count($output) >= 2) {
            $width = isset($output[0]) ? (int) trim($output[0]) : null;
            $height = isset($output[1]) ? (int) trim($output[1]) : null;
            $duration = isset($output[2]) ? (int) round((float) trim($output[2])) : null;

            return [
                'width' => $width > 0 ? $width : null,
                'height' => $height > 0 ? $height : null,
                'duration' => $duration !== null && $duration >= 0 ? $duration : null,
            ];
        }

        // Fallback: ffprobe missing / failed — use the
        // upload-time hint if the uploader set one.
        $meta = is_array($media->metadata) ? $media->metadata : [];
        $hints = is_array($meta['upload'] ?? null) ? $meta['upload'] : [];

        $width = isset($hints['width']) ? (int) $hints['width'] : null;
        $height = isset($hints['height']) ? (int) $hints['height'] : null;
        $duration = isset($hints['duration']) ? (int) $hints['duration'] : null;

        return [
            'width' => $width !== null && $width > 0 ? $width : null,
            'height' => $height !== null && $height > 0 ? $height : null,
            'duration' => $duration !== null && $duration >= 0 ? $duration : null,
        ];
    }
}
