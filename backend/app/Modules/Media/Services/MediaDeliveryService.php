<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Shared\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaDeliveryService
{
    public function __construct(
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    public function serve(string $media): StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $row = Media::query()->find($media);

        if ($row === null) {
            return ApiResponse::error('Media not found', 404, 'NOT_FOUND');
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
        );

        $abs = $disk->path($row->storage_path);

        return response()->file($abs, [
            'Content-Type' => $row->mime,
            'Cache-Control' => 'private, max-age=300',
        ]);
    }
}
