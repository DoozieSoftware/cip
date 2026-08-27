<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Upload pipeline for textile collection photos.
 *
 * Mirrors MediaService::uploadPhoto internals — same storage disk,
 * sha256 checksum, and chain-of-custody audit — but operates on
 * textile collection IDs instead of report IDs. Bypasses the
 * quarantine pipeline; scan_status is set to CLEAN directly.
 */
final class TextileCollectionMediaService
{
    /** @var int 10 MB */
    private const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

    private const MAX_PROOF_PHOTOS = 3;

    public function __construct(
        private readonly MimeValidator $mimeValidator,
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    /**
     * Upload a citizen evidence photo for a textile collection request.
     *
     * Replace semantics: a new citizen photo marks the previous
     * evidence photo `is_replaced = true` (chain of custody).
     */
    public function uploadEvidence(
        string $collectionId,
        UploadedFile $file,
        string $uploaderId,
    ): Media {
        $this->mimeValidator->validate($file, 'PHOTO');
        $this->assertSizeUnderLimit($file);

        // Mark previous citizen evidence as replaced.
        Media::query()
            ->where('textile_collection_id', $collectionId)
            ->where('role', 'evidence')
            ->where('is_replaced', false)
            ->update([
                'is_replaced' => true,
                'updated_at' => now(),
            ]);

        return $this->store($collectionId, $file, $uploaderId, 'evidence');
    }

    /**
     * Upload a staff proof photo for a textile collection request.
     *
     * Allows up to 3 proof photos per collection (append).
     */
    public function uploadProof(
        string $collectionId,
        UploadedFile $file,
        string $uploaderId,
    ): Media {
        $this->mimeValidator->validate($file, 'PHOTO');
        $this->assertSizeUnderLimit($file);
        $this->assertProofCountUnderLimit($collectionId);

        return $this->store($collectionId, $file, $uploaderId, 'proof');
    }

    private function store(
        string $collectionId,
        UploadedFile $file,
        string $uploaderId,
        string $role,
    ): Media {
        $id = (string) Str::uuid();
        $extension = $this->extensionFor($file);
        /** @var string $diskName */
        $diskName = config('cip.media.disk', 'local');
        $prefix = $role === 'proof' ? 'proof' : 'evidence';
        $storagePath = sprintf(
            '%s/textile/%s/photo/%s.%s',
            $prefix,
            $collectionId,
            $id,
            $extension,
        );

        $sourcePath = $file->getRealPath();

        if (! is_string($sourcePath) || $sourcePath === '' || ! is_file($sourcePath)) {
            throw ApiException::serverError('Unable to stage the uploaded photo.');
        }

        $sha256 = hash_file('sha256', $sourcePath);

        if (! is_string($sha256) || preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1) {
            throw ApiException::serverError('Unable to establish uploaded photo integrity.');
        }

        $stream = fopen($sourcePath, 'rb');

        if ($stream === false) {
            throw ApiException::serverError('Unable to read uploaded photo.');
        }

        try {
            $written = Storage::disk($diskName)->put($storagePath, $stream);
        } finally {
            fclose($stream);
        }

        if (! $written) {
            throw ApiException::serverError('Failed to store uploaded photo.');
        }

        [$width, $height] = $this->photoDimensions($file);

        $media = Media::query()->create([
            'id' => $id,
            'report_id' => null,
            'textile_collection_id' => $collectionId,
            'type' => 'PHOTO',
            'role' => $role,
            'storage_disk' => $diskName,
            'storage_path' => $storagePath,
            'mime' => (string) $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'width' => $width,
            'height' => $height,
            'checksum' => $sha256,
            'scan_status' => MediaScanStatus::CLEAN,
            'uploaded_at' => now(),
            'uploaded_by' => $uploaderId,
            'metadata' => ['source' => 'textile_photo_upload'],
            'version' => 1,
            'is_replaced' => false,
        ]);

        $this->chainOfCustody->record(
            $media,
            ChainOfCustodyWriter::EVENT_UPLOAD,
            metadata: [
                'sha256' => $sha256,
                'storage_path' => $storagePath,
                'context' => 'textile_collection',
            ],
        );

        ComputeHashesJob::dispatch($media->id);
        GenerateThumbnailJob::dispatch($media->id);

        return $media;
    }

    private function assertSizeUnderLimit(UploadedFile $file): void
    {
        $size = (int) $file->getSize();

        if ($size > self::MAX_PHOTO_BYTES) {
            throw new ApiException(
                'VALIDATION_FAILED',
                'Uploaded photo exceeds the maximum size of '.self::MAX_PHOTO_BYTES.' bytes.',
                422,
                ['limit' => self::MAX_PHOTO_BYTES, 'size' => $size],
            );
        }
    }

    private function assertProofCountUnderLimit(string $collectionId): void
    {
        $existing = Media::query()
            ->where('textile_collection_id', $collectionId)
            ->where('role', 'proof')
            ->where('is_replaced', false)
            ->count();

        if ($existing >= self::MAX_PROOF_PHOTOS) {
            throw new ApiException(
                'VALIDATION_FAILED',
                'Maximum '.self::MAX_PROOF_PHOTOS.' proof photos per collection reached; upload rejected.',
                422,
                ['limit' => self::MAX_PROOF_PHOTOS, 'existing' => $existing],
            );
        }
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
            default => 'bin',
        };
    }

    /** @return array{0:int|null,1:int|null} */
    private function photoDimensions(UploadedFile $file): array
    {
        $dimensions = @getimagesize((string) $file->getRealPath());

        if (! is_array($dimensions)) {
            return [null, null];
        }

        return [
            $dimensions[0] > 0 ? $dimensions[0] : null,
            $dimensions[1] > 0 ? $dimensions[1] : null,
        ];
    }
}
