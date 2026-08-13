<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Repositories\MediaQuarantineRepository;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Shared\Enums\ErrorCode;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;

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
 *   3. VirusScanService — ClamAvScanner (CIP_MEDIA_SCANNER=clamav)
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

    private readonly MediaQuarantineService $quarantine;

    public function __construct(
        private readonly MimeValidator $mimeValidator,
        VirusScanServiceInterface $scanner,
        ?MediaQuarantineService $quarantine = null,
    ) {
        // Keep the scanner argument as the stable construction seam used by
        // module tests while production DI resolves the full quarantine
        // service and its repository/custody dependencies.
        $this->quarantine = $quarantine ?? new MediaQuarantineService(
            $scanner,
            app(ChainOfCustodyWriter::class),
            app(MediaQuarantineRepository::class),
        );
    }

    public function uploadPhoto(
        string $reportId,
        UploadedFile $file,
        string $uploaderId,
        string $role = 'evidence',
        ?string $assignmentId = null,
        ?string $departmentId = null,
    ): Media {
        return $this->upload($reportId, $file, $uploaderId, 'PHOTO', null, $role, $assignmentId, $departmentId);
    }

    /**
     * @param  array<string, int>|null  $hints
     */
    public function uploadVideo(
        string $reportId,
        UploadedFile $file,
        string $uploaderId,
        ?array $hints = null,
    ): Media {
        return $this->upload($reportId, $file, $uploaderId, 'VIDEO', $hints);
    }

    public function uploadDocument(
        string $reportId,
        UploadedFile $file,
        string $uploaderId,
        string $role = 'evidence',
        ?string $assignmentId = null,
        ?string $departmentId = null,
    ): Media {
        return $this->upload($reportId, $file, $uploaderId, 'DOCUMENT', null, $role, $assignmentId, $departmentId);
    }

    /**
     * The core upload pipeline. Validates, scans, writes, and
     * dispatches the post-processing jobs.
     *
     * @param  array<string, int>|null  $hints
     */
    private function upload(
        string $reportId,
        UploadedFile $file,
        string $uploaderId,
        string $type,
        ?array $hints = null,
        string $role = 'evidence',
        ?string $assignmentId = null,
        ?string $departmentId = null,
    ): Media {
        $this->mimeValidator->validate($file, $type);

        $this->assertReportExists($reportId);
        $this->assertOwnershipScope($reportId, $role, $assignmentId, $departmentId);
        $this->assertCountUnderLimit($reportId, $type, $role, $assignmentId);
        $this->assertSizeUnderLimit($file, $type);

        $media = $this->quarantine->ingest(
            $reportId,
            $file,
            $uploaderId,
            $type,
            $hints,
            $role,
            $assignmentId,
            $departmentId,
        );

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

    private function assertReportExists(string $reportId): void
    {
        $exists = Report::query()->whereKey($reportId)->exists();

        if (! $exists) {
            throw ApiException::notFound('Report');
        }
    }

    private function assertCountUnderLimit(
        string $reportId,
        string $type,
        string $role = 'evidence',
        ?string $assignmentId = null,
    ): void {
        // Limit is scoped per role so officer proof photos never
        // collide with the citizen evidence quota (and vice versa).
        $existing = Media::query()
            ->where('report_id', $reportId)
            ->where('type', $type)
            ->where('role', $role)
            ->when($role === 'proof', fn ($query) => $query->where('assignment_id', $assignmentId))
            ->whereIn('scan_status', [
                MediaScanStatus::PENDING->value,
                MediaScanStatus::CLEAN->value,
                MediaScanStatus::UNKNOWN->value,
            ])
            ->count();
        $limit = self::MAX_COUNT[$type] ?? 0;

        if ($limit > 0 && $existing >= $limit) {
            // A second video is a 409, not a 422 — the
            // report already has a video; the request is in
            // conflict with the current state, not malformed.
            if ($type === 'VIDEO') {
                throw new ApiException(
                    ErrorCode::VIDEO_ALREADY_PRESENT->value,
                    'A video has already been attached to this report.',
                    409,
                    ['existing' => $existing],
                );
            }

            throw new ApiException(
                ErrorCode::VALIDATION_FAILED->value,
                "Maximum {$limit} {$type} per report reached; upload rejected.",
                422,
                ['type' => $type, 'limit' => $limit, 'existing' => $existing],
            );
        }
    }

    private function assertOwnershipScope(
        string $reportId,
        string $role,
        ?string $assignmentId,
        ?string $departmentId,
    ): void {
        if (! in_array($role, ['evidence', 'proof'], true)) {
            throw ApiException::validation('Unsupported media role.', [
                'role' => ['Role must be evidence or proof.'],
            ]);
        }

        if ($role === 'evidence') {
            if ($assignmentId !== null || $departmentId !== null) {
                throw ApiException::validation('Citizen evidence cannot carry assignment ownership.');
            }

            return;
        }

        if ($assignmentId === null || $departmentId === null) {
            throw ApiException::validation(
                'Completion proof requires assignment and department ownership.',
                ['assignment_id' => ['Required for proof media.']],
            );
        }

        $matches = ReportAssignment::query()
            ->whereKey($assignmentId)
            ->where('report_id', $reportId)
            ->where('department_id', $departmentId)
            ->whereNull('reassigned_at')
            ->whereIn('task_status', [
                ReportAssignment::TASK_STATUS_OPEN,
                ReportAssignment::TASK_STATUS_COMPLETED,
            ])
            ->exists();

        if (! $matches) {
            throw ApiException::validation(
                'Completion proof ownership does not match a current report assignment.',
                ['assignment_id' => ['Assignment, report, and department must match.']],
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
