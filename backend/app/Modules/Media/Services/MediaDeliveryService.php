<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Shared\Enums\ErrorCode;
use App\Modules\Shared\Http\Responses\ApiResponse;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaDeliveryService
{
    public function __construct(
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    public function serve(string $media): StreamedResponse|BinaryFileResponse|RedirectResponse|JsonResponse
    {
        $row = Media::query()->find($media);

        if ($row === null) {
            return ApiResponse::error('Media not found', 404, 'NOT_FOUND');
        }

        if ($row->scan_status !== MediaScanStatus::CLEAN) {
            return ApiResponse::error(
                'Media is quarantined and unavailable.',
                409,
                ErrorCode::MEDIA_QUARANTINED->value,
            );
        }

        if (($row->role ?? 'evidence') === 'proof' && ! $this->hasValidProofScope($row)) {
            return ApiResponse::error(
                'The signed proof scope does not match this media.',
                403,
                'MEDIA_SCOPE_MISMATCH',
            );
        }

        $disk = Storage::disk($row->storage_disk);

        if (! $disk->exists($row->storage_path)) {
            return ApiResponse::error('Media bytes missing on storage', 410, 'NOT_FOUND');
        }

        $this->chainOfCustody->record(
            $row,
            ChainOfCustodyWriter::EVENT_DOWNLOAD,
            null,
            request()->ip(),
            request()->userAgent(),
            [
                'signed_scope_verified' => ($row->role ?? 'evidence') === 'proof',
                'assignment_id' => $row->assignment_id,
                'department_id' => $row->department_id,
            ],
        );

        // Object storage owns delivery for S3/MinIO/R2. The app records the
        // access above, then redirects to a native presigned URL instead of
        // calling disk->path(), which is unsupported for remote adapters.
        if ($disk->getAdapter() instanceof AwsS3V3Adapter) {
            return redirect()->away(app(MediaUrl::class)->temporary($row));
        }

        $abs = $disk->path($row->storage_path);

        return response()->file($abs, [
            'Content-Type' => $row->mime,
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    private function hasValidProofScope(Media $media): bool
    {
        $assignment = request()->query('assignment');
        $department = request()->query('department');

        return is_string($assignment)
            && is_string($department)
            && hash_equals((string) ($media->assignment_id ?? ''), $assignment)
            && hash_equals((string) ($media->department_id ?? ''), $department);
    }
}
