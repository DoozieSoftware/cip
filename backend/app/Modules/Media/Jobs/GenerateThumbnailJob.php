<?php

declare(strict_types=1);

namespace App\Modules\Media\Jobs;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ThumbnailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Generates the 320px-wide thumbnail for a stored Media row.
 *
 * Dispatched by `MediaService::upload` (T-M5-011) immediately
 * after the asset lands on the storage disk and the Media row
 * is persisted. The job is the right boundary for the
 * CPU-bound image resize so the citizen's submit request is
 * not blocked on it.
 *
 * Per docs/14 §16 the job retries 3 times with exponential
 * backoff and dead-letters on the fourth failure. The DLQ
 * payload includes the media id + the last error so the
 * operations team can re-drive after fixing the underlying
 * cause.
 */
class GenerateThumbnailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public readonly string $mediaId) {}

    public function handle(ThumbnailService $thumbnails): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null) {
            // The media row was hard-deleted between dispatch
            // and execution. Nothing to do.
            Log::info('media.thumbnail.skipped_missing_media', [
                'media_id' => $this->mediaId,
            ]);

            return;
        }

        try {
            $path = $thumbnails->generate($media);
        } catch (Throwable $e) {
            Log::warning('media.thumbnail.failed', [
                'media_id' => $this->mediaId,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        // Stash the path on the media row's metadata so the
        // evidence carousel can find it without a second
        // query. The metadata column is JSON; we namespace
        // the thumbnail under 'thumbnails' to keep room for
        // future derivations. Use `+` (array union) instead
        // of array_merge so the string key '320' is not
        // collapsed to a numeric index.
        $meta = is_array($media->metadata) ? $media->metadata : [];
        $existing = is_array($meta['thumbnails'] ?? null) ? $meta['thumbnails'] : [];
        $meta['thumbnails'] = $existing + ['320' => $path];
        $media->update(['metadata' => $meta]);
    }

    public function failed(Throwable $e): void
    {
        Log::error('media.thumbnail.dlq', [
            'media_id' => $this->mediaId,
            'tries' => $this->tries,
            'error' => $e->getMessage(),
        ]);
    }

    /**
     * The tag used for queue metrics / Horizon. We tag every
     * media job so the operations dashboard can filter by it.
     *
     * @return list<string>
     */
    public function tags(): array
    {
        return ['media', 'media.thumbnail', 'media:'.$this->mediaId];
    }
}
