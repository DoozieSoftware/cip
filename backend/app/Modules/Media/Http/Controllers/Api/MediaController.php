<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Controllers\Api;

use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\MediaAuditService;
use App\Modules\Media\Services\MediaAuthorizationService;
use App\Modules\Media\Services\MediaDeliveryService;
use App\Modules\Media\Services\MediaIndexService;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaController extends BaseController
{
    public function __construct(
        private readonly MediaService $service,
        private readonly MediaDeliveryService $deliveryService,
        private readonly MediaIndexService $indexService,
        private readonly MediaAuditService $auditService,
        private readonly MediaAuthorizationService $authorizationService,
        private readonly ReportRepository $repository,
        private readonly MediaUrl $mediaUrl,
    ) {}

    public function uploadPhotos(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $denied = $this->authorizationService->assertCanModifyMedia($request, $reportId);

        if ($denied instanceof JsonResponse) {
            return $denied;
        }

        /** @var User $user */
        $user = $request->user('sanctum');
        $userId = (string) $user->id;
        $files = (array) $request->file('photos', []);

        $created = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $created[] = new MediaResource(
                $this->service->uploadPhoto($reportId, $file, $userId)
            );
        }

        return $this->respond(
            ['media' => $created],
            'Photos uploaded',
            201,
            ['count' => count($created)],
        );
    }

    public function uploadVideo(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $denied = $this->authorizationService->assertCanModifyMedia($request, $reportId);

        if ($denied instanceof JsonResponse) {
            return $denied;
        }

        /** @var User $user */
        $user = $request->user('sanctum');
        $userId = (string) $user->id;
        $file = $request->file('video');

        $duration = $request->input('duration_seconds');

        if (is_numeric($duration)) {
            $this->service->assertVideoDurationWindow((int) $duration);
        }

        $hints = null;

        if (is_numeric($duration)) {
            $hints = ['duration' => (int) $duration];
            $w = $request->input('width');
            $h = $request->input('height');

            if (is_numeric($w)) {
                $hints['width'] = (int) $w;
            }

            if (is_numeric($h)) {
                $hints['height'] = (int) $h;
            }
        }

        $created = $this->service->uploadVideo($reportId, $file, $userId, $hints);

        return $this->respond(
            ['media' => new MediaResource($created)],
            'Video uploaded',
            201,
        );
    }

    public function index(string $reportId, Request $request): JsonResponse
    {
        $report = $this->repository->findById($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'REPORT_NOT_FOUND');
        }

        $this->authorize('viewReportMedia', $report);

        /** @var User|null $user */
        $user = $request->user('sanctum');
        $media = $this->indexService->listForReport($reportId, $user, $request);
        $includePath = $this->indexService->isStaff($user) && $request->boolean('include_storage_path');

        $items = $media->map(function (Media $m) use ($request, $includePath): array {
            $row = (new MediaResource($m))->resolve($request);
            $expiresAt = now()->addMinutes(MediaUrl::DEFAULT_TTL_MINUTES);
            $row['signed_url'] = $this->mediaUrl->temporary($m, MediaUrl::DEFAULT_TTL_MINUTES);
            $row['signed_url_expires_at'] = $expiresAt->toIso8601String();

            if (! $includePath) {
                unset($row['storage_path'], $row['storage_disk']);
            }

            return $row;
        })->all();

        return $this->respond(
            ['media' => $items],
            'OK',
            200,
            ['count' => count($items)],
        );
    }

    public function audit(string $reportId, string $media, Request $request): JsonResponse
    {
        return $this->auditService->audit($reportId, $media, $request);
    }

    public function serve(string $media): StreamedResponse|BinaryFileResponse|RedirectResponse|JsonResponse
    {
        return $this->deliveryService->serve($media);
    }
}
