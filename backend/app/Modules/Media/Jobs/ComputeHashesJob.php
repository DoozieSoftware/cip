<?php

declare(strict_types=1);

namespace App\Modules\Media\Jobs;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Media\Services\HashService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\UploadedFile;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Computes and persists the per-asset hash row for a stored
 * Media row.
 *
 * The job reads the bytes back off the configured storage
 * disk via Storage::disk(\$media->storage_disk) and feeds them
 * to HashService::compute. The result is then written to the
 * `media_hashes` table.
 *
 * Per docs/14 §16 the job retries 3 times with exponential
 * backoff and dead-letters on the fourth failure. Hash
 * computation is CPU-bound and I/O-bound (re-reading the
 * asset from MinIO), so it always runs on the queue.
 */
class ComputeHashesJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public readonly string $mediaId)
    {
        $this->onQueue('media');
    }

    public function handle(HashService $hashes): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null) {
            Log::info('media.hashes.skipped_missing_media', [
                'media_id' => $this->mediaId,
            ]);

            return;
        }

        try {
            $upload = $this->asUploadedFile($media);
            $result = $hashes->compute($upload);
        } catch (Throwable $e) {
            Log::warning('media.hashes.failed', [
                'media_id' => $this->mediaId,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        MediaHash::query()->create([
            'media_id' => $media->id,
            'sha256' => $result['sha256'],
            'sha512' => $result['sha512'],
            'perceptual_hash' => $result['perceptual_hash'],
            'video_fingerprint' => $result['video_fingerprint'],
            'created_at' => now(),
        ]);

        // The Media row also carries a quick sha256 for
        // dedup-by-content without joining media_hashes.
        $media->checksum = $result['sha256'];
        $media->save();
    }

    public function failed(Throwable $e): void
    {
        Log::error('media.hashes.dlq', [
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
        return ['media', 'media.hashes', 'media:'.$this->mediaId];
    }

    /**
     * HashService::compute is typed against UploadedFile but
     * here we are reading the bytes from the storage disk, not
     * from an in-flight upload. Wrap the bytes in a temporary
     * UploadedFile so the signature stays stable.
     */
    private function asUploadedFile(Media $media): UploadedFile
    {
        $disk = Storage::disk($media->storage_disk);

        if (! $disk->exists($media->storage_path)) {
            throw new RuntimeException(
                "ComputeHashesJob: source asset missing on disk: {$media->storage_disk}::{$media->storage_path}"
            );
        }

        $bytes = $disk->get($media->storage_path);

        if ($bytes === null) {
            throw new RuntimeException(
                "ComputeHashesJob: cannot read source asset: {$media->storage_path}"
            );
        }

        $tmp = tempnam(sys_get_temp_dir(), 'cip-hash-');
        $ext = strtolower((string) pathinfo($media->storage_path, PATHINFO_EXTENSION));
        $tmpExt = $tmp.'.'.$ext;
        rename($tmp, $tmpExt);
        file_put_contents($tmpExt, $bytes);

        return new UploadedFile(
            $tmpExt,
            basename($media->storage_path),
            $media->mime,
            null,
            true,
        );
    }
}
