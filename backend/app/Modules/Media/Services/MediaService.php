<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Enums\ErrorCode;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Owns the write side of the M5 media pipeline.
 *
 *  - uploadPhoto(reportId, file, uploaderId) : Media
 *  - uploadVideo(reportId, file, uploaderId) : Media
 *  - uploadDocument(reportId, file, uploaderId) : Media
 *
 * Per docs/05 §14 + docs/11 §13 every upload is gated by:
 *
 *   1. MimeValidator — server-mime, client-mime, magic bytes
 *   2. per-type caps  — max count (10 photos, 1 video, * docs),
 *                       max size (16 MB photo, 100 MB video),
 *                       video duration window (3 – 300 s)
 *   3. VirusScanService — defaults to LogScanner; production
 *      flips to ClamAvScanner via CIP_MEDIA_SCANNER=clamav
 *
 * On success the bytes are streamed into the configured
 * storage disk under:
 *
 *   evidence/<report-id>/<type>/<media-uuid>.<ext>
 *
 * The path is unique by the UUID so a re-upload never
 * overwrites an existing asset (the storage_disk layer is
 * append-only). After the row is persisted the three
 * post-processing jobs are dispatched:
 *
 *   - ComputeHashesJob
 *   - ExtractVideoMetadataJob (video only)
 *   - GenerateThumbnailJob    (photo only)
 */
class MediaService
{
    /** @var array<string, int> max bytes per type */
    public const MAX_BYTES = [
        'PHOTO' => 16 * 1024 * 1024,    // 16 MB
        'VIDEO' => 100 * 1024 * 1024,   // 100 MB
        'DOCUMENT' => 25 * 1024 * 1024, // 25 MB
    ];

    /** @var array<string, int> max count per report per type */
    public const MAX_COUNT = [
        'PHOTO' => 10,
        'VIDEO' => 1,
        'DOCUMENT' => 5,
    ];

    public const VIDEO_MIN_DURATION = 3;

    public const VIDEO_MAX_DURATION = 300;

    public function __construct(
        private readonly MimeValidator $mimeValidator,
        private readonly VirusScanServiceInterface $scanner,
    ) {}

    public function uploadPhoto(string $reportId, UploadedFile $file, string $uploaderId): Media
    {
        return $this->upload($reportId, $file, $uploaderId, 'PHOTO');
    }

    public function uploadVideo(string $reportId, UploadedFile $file, string $uploaderId): Media
    {
        return $this->upload($reportId, $file, $uploaderId, 'VIDEO');
    }

    public function uploadDocument(string $reportId, UploadedFile $file, string $uploaderId): Media
    {
        return $this->upload($reportId, $file, $uploaderId, 'DOCUMENT');
    }

    /**
     * The core upload pipeline. Validates, scans, writes, and
     * dispatches the post-processing jobs.
     */
    private function upload(string $reportId, UploadedFile $file, string $uploaderId, string $type): Media
    {
        $this->mimeValidator->validate($file, $type);

        $this->assertReportExists($reportId);
        $this->assertCountUnderLimit($reportId, $type);
        $this->assertSizeUnderLimit($file, $type);

        $clean = $this->scanner->scan($file->getRealPath() ?: '');

        if (! $clean) {
            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                'Uploaded file failed the virus scan and was rejected.',
                422,
                ['scanner' => $this->scanner->name()],
            );
        }

        $media = $this->persist($reportId, $file, $uploaderId, $type);

        // Dispatch the post-processing jobs.
        ComputeHashesJob::dispatch($media->id);

        if ($type === 'PHOTO') {
            GenerateThumbnailJob::dispatch($media->id);
        }

        if ($type === 'VIDEO') {
            ExtractVideoMetadataJob::dispatch($media->id);
        }

        return $media;
    }

    private function persist(string $reportId, UploadedFile $file, string $uploaderId, string $type): Media
    {
        $id = (string) Str::uuid();
        $ext = strtolower((string) $file->getClientOriginalExtension());

        if ($ext === '') {
            $ext = $this->extFromMime($file->getMimeType() ?? '');
        }

        $disk = (string) config('cip.media.disk', 'local');
        $path = sprintf('evidence/%s/%s/%s.%s', $reportId, strtolower($type), $id, $ext);

        try {
            $bytes = file_get_contents($file->getRealPath() ?: '');

            if ($bytes === false) {
                throw new \RuntimeException('cannot read upload temp file');
            }
            Storage::disk($disk)->put($path, $bytes);
        } catch (Throwable $e) {
            Log::error('media.upload.write_failed', [
                'report_id' => $reportId,
                'type' => $type,
                'disk' => $disk,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            throw new ApiException(
                ErrorCode::INTERNAL_ERROR->value,
                'Failed to persist uploaded media.',
                500,
                ['disk' => $disk, 'path' => $path],
                $e,
            );
        }

        return Media::query()->create([
            'id' => $id,
            'report_id' => $reportId,
            'type' => $type,
            'storage_disk' => $disk,
            'storage_path' => $path,
            'mime' => (string) $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'duration' => null,
            'width' => null,
            'height' => null,
            'checksum' => '', // filled by ComputeHashesJob
            'captured_at' => null,
            'uploaded_at' => now(),
            'uploaded_by' => $uploaderId,
            'metadata' => null,
            'version' => 1,
            'is_replaced' => false,
        ]);
    }

    private function assertReportExists(string $reportId): void
    {
        $exists = Report::query()->whereKey($reportId)->exists();

        if (! $exists) {
            throw ApiException::notFound('Report');
        }
    }

    private function assertCountUnderLimit(string $reportId, string $type): void
    {
        $existing = Media::query()
            ->where('report_id', $reportId)
            ->where('type', $type)
            ->count();
        $limit = self::MAX_COUNT[$type] ?? 0;

        if ($limit > 0 && $existing >= $limit) {
            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                "Maximum {$limit} {$type} per report reached; upload rejected.",
                422,
                ['type' => $type, 'limit' => $limit, 'existing' => $existing],
            );
        }
    }

    private function assertSizeUnderLimit(UploadedFile $file, string $type): void
    {
        $limit = self::MAX_BYTES[$type] ?? 0;
        $size = (int) $file->getSize();

        if ($limit > 0 && $size > $limit) {
            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                "Uploaded {$type} exceeds the maximum size of {$limit} bytes.",
                422,
                ['type' => $type, 'limit' => $limit, 'size' => $size],
            );
        }
    }

    private function extFromMime(string $mime): string
    {
        return match (strtolower($mime)) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            'application/pdf' => 'pdf',
            default => 'bin',
        };
    }

    /**
     * Enforce the per-type video duration window.
     *
     * The duration is only known after ExtractVideoMetadataJob
     * has run; the rule still lives here so the calling
     * controllers (T-M5-013) can call it on the metadata the
     * uploader supplied when they want to short-circuit the
     * upload before persisting the bytes.
     */
    public function assertVideoDurationWindow(int $durationSeconds): void
    {
        if ($durationSeconds < self::VIDEO_MIN_DURATION) {
            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                'Video duration is below the minimum of '.self::VIDEO_MIN_DURATION.' seconds.',
                422,
                ['min' => self::VIDEO_MIN_DURATION, 'duration' => $durationSeconds],
            );
        }

        if ($durationSeconds > self::VIDEO_MAX_DURATION) {
            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                'Video duration exceeds the maximum of '.self::VIDEO_MAX_DURATION.' seconds.',
                422,
                ['max' => self::VIDEO_MAX_DURATION, 'duration' => $durationSeconds],
            );
        }
    }
}
