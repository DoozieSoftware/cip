<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Enums\MediaQuarantineReason;
use App\Modules\Media\Enums\MediaQuarantineStatus;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Exceptions\MediaIntegrityException;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Jobs\RecoverQuarantinedMediaJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaQuarantine;
use App\Modules\Media\Repositories\MediaQuarantineRepository;
use App\Modules\Shared\Enums\ErrorCode;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Durable malware quarantine boundary for uploaded evidence.
 *
 * Bytes are written under quarantine/ before a scanner is invoked. A CLEAN
 * verdict copies the same verified bytes to the append-only evidence/proof
 * namespace and only then marks the row deliverable. INFECTED and UNKNOWN
 * verdicts retain the original object and its hash for operational review.
 */
final class MediaQuarantineService
{
    public function __construct(
        private readonly VirusScanServiceInterface $scanner,
        private readonly ChainOfCustodyWriter $chainOfCustody,
        private readonly MediaQuarantineRepository $quarantines,
    ) {}

    /**
     * @param  array<string, mixed>|null  $hints
     */
    public function ingest(
        string $reportId,
        UploadedFile $file,
        string $uploaderId,
        string $type,
        ?array $hints = null,
        string $role = 'evidence',
        ?string $assignmentId = null,
        ?string $departmentId = null,
    ): Media {
        $sourcePath = $file->getRealPath();

        if (! is_string($sourcePath) || $sourcePath === '' || ! is_file($sourcePath)) {
            throw new ApiException(
                ErrorCode::INTERNAL_ERROR->value,
                'Unable to stage the uploaded media.',
                500,
            );
        }

        $id = (string) Str::uuid();
        $extension = $this->extensionFor($file);
        $diskName = $this->configuredDisk();
        $scopePath = $role === 'proof' && $assignmentId !== null
            ? $assignmentId.'/'.strtolower($type)
            : strtolower($type);
        $quarantinePath = sprintf('quarantine/%s/%s/%s.%s', $reportId, $scopePath, $id, $extension);
        $sha256 = hash_file('sha256', $sourcePath);

        if (! is_string($sha256) || preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1) {
            throw new ApiException(
                ErrorCode::INTERNAL_ERROR->value,
                'Unable to establish uploaded media integrity.',
                500,
            );
        }

        $this->writeQuarantineObject($diskName, $quarantinePath, $sourcePath);

        try {
            /** @var array{0:Media,1:MediaQuarantine} $created */
            $created = DB::transaction(function () use (
                $id,
                $reportId,
                $file,
                $uploaderId,
                $type,
                $hints,
                $role,
                $assignmentId,
                $departmentId,
                $diskName,
                $quarantinePath,
                $sha256,
            ): array {
                $metadata = [
                    'scanner' => $this->scanner->name(),
                    'quarantine' => true,
                ];
                $capturedAt = $this->captureTimeFromHints($hints);
                $imageMetadata = $this->imageMetadata($file, $type);

                if ($hints !== null && $hints !== []) {
                    $metadata['upload'] = $hints;
                }

                if ($imageMetadata !== []) {
                    $metadata['image_metadata'] = $imageMetadata;
                }

                [$width, $height] = $this->photoDimensions($file, $type);
                $media = Media::query()->create([
                    'id' => $id,
                    'report_id' => $reportId,
                    'assignment_id' => $assignmentId,
                    'department_id' => $departmentId,
                    'type' => $type,
                    'role' => $role,
                    'storage_disk' => $diskName,
                    'storage_path' => $quarantinePath,
                    'mime' => (string) $file->getMimeType(),
                    'size' => (int) $file->getSize(),
                    'duration' => null,
                    'width' => $width,
                    'height' => $height,
                    'checksum' => $sha256,
                    'scan_status' => MediaScanStatus::PENDING,
                    'scan_attempted_at' => now(),
                    'captured_at' => $capturedAt,
                    'uploaded_at' => now(),
                    'uploaded_by' => $uploaderId,
                    'metadata' => $metadata,
                    'version' => 1,
                    'is_replaced' => false,
                ]);

                $quarantine = $this->quarantines->createFor($media, $this->scanner->name(), $sha256);
                $auditMetadata = [
                    'scanner' => $this->scanner->name(),
                    'quarantine_id' => $quarantine->id,
                    'quarantine_path' => $quarantinePath,
                    'sha256' => $sha256,
                ];

                if (is_array($hints['capture'] ?? null)) {
                    $auditMetadata['capture'] = $hints['capture'];
                }

                if ($imageMetadata !== []) {
                    $auditMetadata['image_metadata'] = $imageMetadata;
                }

                $this->chainOfCustody->record(
                    $media,
                    ChainOfCustodyWriter::EVENT_UPLOAD,
                    $media->uploader()->first(),
                    metadata: $auditMetadata,
                );

                return [$media, $quarantine];
            });
        } catch (Throwable $e) {
            // The object deliberately remains at its unique quarantine key.
            // A DB outage must not turn an accepted upload into silent loss;
            // the path and digest let operators reconcile the orphan safely.
            Log::critical('media.quarantine.metadata_failed', [
                'media_id' => $id,
                'report_id' => $reportId,
                'disk' => $diskName,
                'path' => $quarantinePath,
                'sha256' => $sha256,
                'error_type' => $e::class,
            ]);

            throw new ApiException(
                ErrorCode::MEDIA_SCAN_UNAVAILABLE->value,
                'The upload was retained in quarantine, but processing is temporarily unavailable.',
                503,
                ['media_id' => $id, 'retryable' => true],
                $e,
            );
        }

        [$media, $quarantine] = $created;

        try {
            $localPath = $this->materializeForScan($media, $quarantine);
        } catch (MediaIntegrityException $e) {
            $this->markIntegrityFailed($media, $quarantine, $e);

            throw $this->unavailableException($media, $e);
        } catch (Throwable $e) {
            $this->markUnknown($media, $quarantine, MediaQuarantineReason::SCANNER_ERROR, $e);

            return $this->deferRecovery($media, $quarantine);
        }

        try {
            try {
                $clean = $this->scanner->scan($localPath);
            } catch (Throwable $e) {
                $this->markUnknown($media, $quarantine, MediaQuarantineReason::SCANNER_ERROR, $e);

                return $this->deferRecovery($media, $quarantine);
            }
        } finally {
            @unlink($localPath);
        }

        if (! $clean) {
            $this->markInfected($media, $quarantine);

            throw new ApiException(
                ErrorCode::MEDIA_INFECTED->value,
                'Uploaded media failed the malware scan and was quarantined.',
                422,
                [
                    'media_id' => $media->id,
                    'quarantine_status' => MediaQuarantineStatus::CONFIRMED_INFECTED->value,
                ],
            );
        }

        try {
            return $this->releaseClean($media, $quarantine);
        } catch (MediaIntegrityException $e) {
            $this->markIntegrityFailed($media, $quarantine, $e);

            throw $this->unavailableException($media, $e);
        } catch (Throwable $e) {
            $this->markUnknown($media, $quarantine, MediaQuarantineReason::RELEASE_ERROR, $e);

            return $this->deferRecovery($media, $quarantine);
        }
    }

    /** @param array<string, mixed>|null $hints */
    private function captureTimeFromHints(?array $hints): ?Carbon
    {
        $capture = $hints['capture'] ?? null;
        $capturedAt = is_array($capture) ? ($capture['captured_at'] ?? null) : null;

        if (! is_string($capturedAt) || $capturedAt === '') {
            return null;
        }

        try {
            return Carbon::parse($capturedAt);
        } catch (Throwable) {
            return null;
        }
    }

    /** @return array<string, mixed> */
    private function imageMetadata(UploadedFile $file, string $type): array
    {
        if ($type !== 'PHOTO' || ! function_exists('exif_read_data')) {
            return [];
        }

        $path = $file->getRealPath();

        if (! is_string($path) || $path === '') {
            return [];
        }

        try {
            $data = @exif_read_data($path, 'EXIF,GPS', true, false);
        } catch (Throwable) {
            return [];
        }

        if (! is_array($data)) {
            return [];
        }

        $exif = is_array($data['EXIF'] ?? null) ? $data['EXIF'] : [];
        $gps = is_array($data['GPS'] ?? null) ? $data['GPS'] : [];
        $metadata = ['source' => 'embedded_exif', 'trusted' => false];
        $originalTime = $exif['DateTimeOriginal'] ?? null;

        if (is_string($originalTime) && $originalTime !== '') {
            $metadata['original_datetime'] = $originalTime;
        }

        $latitude = $this->exifCoordinate($gps['GPSLatitude'] ?? null, $gps['GPSLatitudeRef'] ?? null);
        $longitude = $this->exifCoordinate($gps['GPSLongitude'] ?? null, $gps['GPSLongitudeRef'] ?? null);

        if ($latitude !== null && $longitude !== null) {
            $metadata['latitude'] = $latitude;
            $metadata['longitude'] = $longitude;
        }

        return count($metadata) > 2 ? $metadata : [];
    }

    private function exifCoordinate(mixed $value, mixed $hemisphere): ?float
    {
        if (! is_array($value) || count($value) < 3 || ! is_string($hemisphere)) {
            return null;
        }

        $parts = array_values($value);
        $degrees = $this->exifRational($parts[0] ?? null);
        $minutes = $this->exifRational($parts[1] ?? null);
        $seconds = $this->exifRational($parts[2] ?? null);

        if ($degrees === null || $minutes === null || $seconds === null) {
            return null;
        }

        $coordinate = $degrees + ($minutes / 60) + ($seconds / 3600);

        return in_array(strtoupper($hemisphere), ['S', 'W'], true) ? -$coordinate : $coordinate;
    }

    private function exifRational(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (! is_string($value) || ! str_contains($value, '/')) {
            return null;
        }

        [$numerator, $denominator] = array_pad(explode('/', $value, 2), 2, null);

        if (! is_numeric($numerator) || ! is_numeric($denominator) || (float) $denominator === 0.0) {
            return null;
        }

        return (float) $numerator / (float) $denominator;
    }

    /**
     * Re-scan one operationally eligible quarantine record. Returns null when
     * another worker owns it or it reached a terminal state in the meantime.
     */
    public function recover(string $quarantineId): ?MediaScanStatus
    {
        $configuredStaleSeconds = config('cip.media.quarantine.rescan_stale_seconds', 900);
        $staleSeconds = is_numeric($configuredStaleSeconds) ? (int) $configuredStaleSeconds : 900;
        $quarantine = $this->quarantines->claimForRescan($quarantineId, $staleSeconds);

        if ($quarantine === null) {
            return null;
        }

        $media = $quarantine->media;

        try {
            $localPath = $this->materializeForScan($media, $quarantine);
        } catch (MediaIntegrityException $e) {
            $this->markIntegrityFailed($media, $quarantine, $e);

            return MediaScanStatus::UNKNOWN;
        } catch (Throwable $e) {
            $this->markUnknown($media, $quarantine, MediaQuarantineReason::RELEASE_ERROR, $e);

            return MediaScanStatus::UNKNOWN;
        }

        try {
            try {
                $clean = $this->scanner->scan($localPath);
            } catch (Throwable $e) {
                $this->markUnknown($media, $quarantine, MediaQuarantineReason::SCANNER_ERROR, $e);

                return MediaScanStatus::UNKNOWN;
            }
        } finally {
            @unlink($localPath);
        }

        if (! $clean) {
            $this->markInfected($media, $quarantine);

            return MediaScanStatus::INFECTED;
        }

        try {
            $released = $this->releaseClean($media, $quarantine);
            $this->dispatchPostProcessing($released);

            return MediaScanStatus::CLEAN;
        } catch (MediaIntegrityException $e) {
            $this->markIntegrityFailed($media, $quarantine, $e);

            return MediaScanStatus::UNKNOWN;
        } catch (Throwable $e) {
            $this->markUnknown($media, $quarantine, MediaQuarantineReason::RELEASE_ERROR, $e);

            return MediaScanStatus::UNKNOWN;
        }
    }

    private function releaseClean(Media $media, MediaQuarantine $quarantine): Media
    {
        $disk = Storage::disk($media->storage_disk);
        $source = $media->storage_path;
        $destination = $this->releasePath($media);

        if ($source !== $destination) {
            $sourceExists = $disk->exists($source);
            $destinationExists = $disk->exists($destination);

            if (! $sourceExists && ! $destinationExists) {
                throw new MediaIntegrityException('Neither the quarantine object nor its release copy exists.');
            }

            if (! $destinationExists) {
                if (! $sourceExists || ! $disk->copy($source, $destination)) {
                    throw new RuntimeException('Unable to copy quarantined media into the evidence namespace.');
                }
            }

            if (! hash_equals($quarantine->original_sha256, $this->hashStoredObject($media->storage_disk, $destination))) {
                // The original quarantine object remains authoritative. The
                // failed derived copy is never made deliverable.
                try {
                    $disk->delete($destination);
                } catch (Throwable) {
                    // Delivery remains blocked by scan_status even when the
                    // storage backend cannot remove the derived copy.
                }

                throw new MediaIntegrityException('Released media digest does not match its quarantine digest.');
            }

            if ($sourceExists) {
                try {
                    $deleted = $disk->delete($source);

                    if (! $deleted) {
                        Log::warning('media.quarantine.source_cleanup_failed', [
                            'media_id' => $media->id,
                            'disk' => $media->storage_disk,
                            'path' => $source,
                        ]);
                    }
                } catch (Throwable $e) {
                    Log::warning('media.quarantine.source_cleanup_failed', [
                        'media_id' => $media->id,
                        'disk' => $media->storage_disk,
                        'path' => $source,
                        'error_type' => $e::class,
                    ]);
                }
            }
        } elseif (! hash_equals($quarantine->original_sha256, $this->hashStoredObject($media->storage_disk, $destination))) {
            throw new MediaIntegrityException('Stored media digest does not match its quarantine digest.');
        }

        DB::transaction(function () use ($media, $quarantine, $destination, $source): void {
            $media->forceFill([
                'storage_path' => $destination,
                'scan_status' => MediaScanStatus::CLEAN,
                'scan_attempted_at' => now(),
                'metadata' => array_replace($media->metadata ?? [], [
                    'scanner' => $this->scanner->name(),
                    'quarantine' => false,
                ]),
            ])->save();

            $quarantine->forceFill([
                'status' => MediaQuarantineStatus::RELEASED,
                'reason' => MediaQuarantineReason::AWAITING_SCAN,
                'last_error' => null,
                'released_at' => now(),
            ])->save();

            $this->chainOfCustody->record(
                $media,
                ChainOfCustodyWriter::EVENT_VIRUS_SCAN,
                metadata: [
                    'scanner' => $this->scanner->name(),
                    'verdict' => MediaScanStatus::CLEAN->value,
                    'quarantine_id' => $quarantine->id,
                    'quarantine_path' => $source,
                    'released_path' => $destination,
                    'sha256' => $quarantine->original_sha256,
                ],
            );
        });

        Log::info('media.quarantine.released', [
            'media_id' => $media->id,
            'quarantine_id' => $quarantine->id,
            'scanner' => $this->scanner->name(),
        ]);

        return $media->refresh();
    }

    private function markInfected(Media $media, MediaQuarantine $quarantine): void
    {
        DB::transaction(function () use ($media, $quarantine): void {
            $media->forceFill([
                'scan_status' => MediaScanStatus::INFECTED,
                'scan_attempted_at' => now(),
            ])->save();
            $quarantine->forceFill([
                'status' => MediaQuarantineStatus::CONFIRMED_INFECTED,
                'reason' => MediaQuarantineReason::INFECTED,
                'last_error' => null,
                'last_attempted_at' => now(),
            ])->save();
            $this->recordVerdict($media, $quarantine, MediaScanStatus::INFECTED);
        });
    }

    private function markUnknown(
        Media $media,
        MediaQuarantine $quarantine,
        MediaQuarantineReason $reason,
        Throwable $error,
    ): void {
        DB::transaction(function () use ($media, $quarantine, $reason, $error): void {
            $media->forceFill([
                'scan_status' => MediaScanStatus::UNKNOWN,
                'scan_attempted_at' => now(),
            ])->save();
            $quarantine->forceFill([
                'status' => MediaQuarantineStatus::PENDING_RESCAN,
                'reason' => $reason,
                'last_error' => $this->safeError($error),
                'last_attempted_at' => now(),
            ])->save();
            $this->recordVerdict($media, $quarantine, MediaScanStatus::UNKNOWN);
        });

        Log::warning('media.quarantine.retry_pending', [
            'media_id' => $media->id,
            'quarantine_id' => $quarantine->id,
            'scanner' => $this->scanner->name(),
            'reason' => $reason->value,
            'error_type' => $error::class,
        ]);
    }

    private function markIntegrityFailed(Media $media, MediaQuarantine $quarantine, Throwable $error): void
    {
        DB::transaction(function () use ($media, $quarantine, $error): void {
            $media->forceFill([
                'scan_status' => MediaScanStatus::UNKNOWN,
                'scan_attempted_at' => now(),
            ])->save();
            $quarantine->forceFill([
                'status' => MediaQuarantineStatus::INTEGRITY_FAILED,
                'reason' => MediaQuarantineReason::INTEGRITY_MISMATCH,
                'last_error' => $this->safeError($error),
                'last_attempted_at' => now(),
            ])->save();
            $this->recordVerdict($media, $quarantine, MediaScanStatus::UNKNOWN);
        });

        Log::critical('media.quarantine.integrity_failed', [
            'media_id' => $media->id,
            'quarantine_id' => $quarantine->id,
            'scanner' => $this->scanner->name(),
            'error_type' => $error::class,
        ]);
    }

    private function recordVerdict(Media $media, MediaQuarantine $quarantine, MediaScanStatus $status): void
    {
        $this->chainOfCustody->record(
            $media,
            ChainOfCustodyWriter::EVENT_VIRUS_SCAN,
            metadata: [
                'scanner' => $this->scanner->name(),
                'verdict' => $status->value,
                'quarantine_id' => $quarantine->id,
                'quarantine_status' => $quarantine->status->value,
                'reason' => $quarantine->reason->value,
                'sha256' => $quarantine->original_sha256,
            ],
        );
    }

    private function writeQuarantineObject(string $diskName, string $path, string $sourcePath): void
    {
        $stream = fopen($sourcePath, 'rb');

        if ($stream === false) {
            throw new ApiException(ErrorCode::INTERNAL_ERROR->value, 'Unable to read uploaded media.', 500);
        }

        try {
            $written = Storage::disk($diskName)->put($path, $stream);
        } catch (Throwable $e) {
            throw new ApiException(
                ErrorCode::INTERNAL_ERROR->value,
                'Failed to retain uploaded media in quarantine.',
                500,
                ['disk' => $diskName],
                $e,
            );
        } finally {
            fclose($stream);
        }

        if (! $written) {
            throw new ApiException(
                ErrorCode::INTERNAL_ERROR->value,
                'Failed to retain uploaded media in quarantine.',
                500,
                ['disk' => $diskName],
            );
        }
    }

    private function materializeForScan(Media $media, MediaQuarantine $quarantine): string
    {
        $disk = Storage::disk($media->storage_disk);
        $path = $media->storage_path;

        if (! $disk->exists($path)) {
            $releasedPath = $this->releasePath($media);

            if (! $disk->exists($releasedPath)) {
                throw new MediaIntegrityException('Quarantined media bytes are missing from storage.');
            }

            $path = $releasedPath;
        }

        $input = $disk->readStream($path);

        if (! is_resource($input)) {
            throw new RuntimeException('Unable to read quarantined media from storage.');
        }

        // cPanel's ClamAV wrapper terminates scans of paths under the shared
        // system /tmp directory. Keep the integrity-checked scan copy inside
        // Laravel's private framework storage instead.
        $temporaryPath = tempnam(storage_path('framework'), 'cip-quarantine-');

        if ($temporaryPath === false) {
            fclose($input);

            throw new RuntimeException('Unable to allocate a quarantine scan file.');
        }

        $output = fopen($temporaryPath, 'wb');

        if ($output === false) {
            fclose($input);
            @unlink($temporaryPath);

            throw new RuntimeException('Unable to open the quarantine scan file.');
        }

        try {
            if (stream_copy_to_stream($input, $output) === false) {
                throw new RuntimeException('Unable to materialize quarantined media for scanning.');
            }
        } finally {
            fclose($input);
            fclose($output);
        }

        $actual = hash_file('sha256', $temporaryPath);

        if (! is_string($actual) || ! hash_equals($quarantine->original_sha256, $actual)) {
            @unlink($temporaryPath);

            throw new MediaIntegrityException('Quarantined media digest changed before recovery.');
        }

        return $temporaryPath;
    }

    private function hashStoredObject(string $diskName, string $path): string
    {
        $stream = Storage::disk($diskName)->readStream($path);

        if (! is_resource($stream)) {
            throw new RuntimeException('Unable to read stored media for integrity verification.');
        }

        $context = hash_init('sha256');

        try {
            hash_update_stream($context, $stream);
        } finally {
            fclose($stream);
        }

        return hash_final($context);
    }

    private function releasePath(Media $media): string
    {
        $prefix = ($media->role ?? 'evidence') === 'proof' ? 'proof' : 'evidence';

        if ($prefix === 'proof' && $media->assignment_id !== null) {
            return sprintf(
                '%s/%s/%s/%s/%s',
                $prefix,
                $media->report_id,
                $media->assignment_id,
                strtolower($media->type),
                basename($media->storage_path),
            );
        }

        return sprintf(
            '%s/%s/%s/%s',
            $prefix,
            $media->report_id,
            strtolower($media->type),
            basename($media->storage_path),
        );
    }

    private function configuredDisk(): string
    {
        $configured = config('cip.media.disk', 'local');

        return is_string($configured) && $configured !== '' ? $configured : 'local';
    }

    private function extensionFor(UploadedFile $file): string
    {
        $extension = strtolower((string) $file->getClientOriginalExtension());

        if ($extension !== '') {
            return $extension;
        }

        return match (strtolower((string) $file->getMimeType())) {
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

    /** @return array{0:int|null,1:int|null} */
    private function photoDimensions(UploadedFile $file, string $type): array
    {
        if ($type !== 'PHOTO') {
            return [null, null];
        }

        $dimensions = @getimagesize((string) $file->getRealPath());

        if (! is_array($dimensions)) {
            return [null, null];
        }

        return [
            $dimensions[0] > 0 ? $dimensions[0] : null,
            $dimensions[1] > 0 ? $dimensions[1] : null,
        ];
    }

    private function unavailableException(Media $media, Throwable $error): ApiException
    {
        return new ApiException(
            ErrorCode::MEDIA_SCAN_UNAVAILABLE->value,
            'The upload was retained in quarantine and will be scanned again when the scanner recovers.',
            503,
            [
                'media_id' => $media->id,
                'quarantine_status' => MediaQuarantineStatus::PENDING_RESCAN->value,
                'retryable' => true,
            ],
            $error,
        );
    }

    private function deferRecovery(Media $media, MediaQuarantine $quarantine): Media
    {
        RecoverQuarantinedMediaJob::dispatch($quarantine->id);

        Log::info('media.quarantine.recovery_queued', [
            'media_id' => $media->id,
            'quarantine_id' => $quarantine->id,
            'scanner' => $this->scanner->name(),
        ]);

        return $media;
    }

    private function safeError(Throwable $error): string
    {
        $message = preg_replace('/[\x00-\x1F\x7F]+/', ' ', $error->getMessage()) ?? '';

        return Str::limit(class_basename($error).' '.trim($message), 512, '');
    }

    private function dispatchPostProcessing(Media $media): void
    {
        ComputeHashesJob::dispatch($media->id);

        if ($media->type === 'PHOTO') {
            GenerateThumbnailJob::dispatch($media->id);
        }

        if ($media->type === 'VIDEO') {
            ExtractVideoMetadataJob::dispatch($media->id);
        }
    }
}
