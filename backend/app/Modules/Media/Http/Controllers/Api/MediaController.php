<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Controllers\Api;

use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Services\MediaService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * MediaController per docs/05 §6, §14.
 *
 *  - POST /api/v1/reports/{id}/photos  : uploadPhotos  (T-M5-012)
 *  - POST /api/v1/reports/{id}/video   : uploadVideo   (T-M5-013)
 *  - GET  /api/v1/reports/{id}/media   : index         (T-M5-014)
 *
 * Per AGENTS.md — no business logic here. The service owns
 * the validation, scan, persist, and job-dispatch. The
 * controller only:
 *
 *   1. extracts the uploaded files from the request
 *   2. calls MediaService::uploadPhoto / uploadVideo
 *   3. wraps the result in MediaResource
 *   4. hands the JsonResponse to BaseController::respond
 */
class MediaController extends BaseController
{
    public function __construct(private readonly MediaService $service) {}

    /**
     * POST /api/v1/reports/{id}/photos
     */
    public function uploadPhotos(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $userId = (string) $request->user('sanctum')->id;
        $files = (array) $request->file('photos', []);

        $created = [];

        foreach ($files as $file) {
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

    /**
     * POST /api/v1/reports/{id}/video
     */
    public function uploadVideo(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $userId = (string) $request->user('sanctum')->id;
        $file = $request->file('video');

        $created = $this->service->uploadVideo($reportId, $file, $userId);

        return $this->respond(
            ['media' => new MediaResource($created)],
            'Video uploaded',
            201,
        );
    }

    /**
     * GET /api/v1/reports/{id}/media
     * Stub for T-M5-014; the index method is implemented there.
     */
    public function index(string $reportId, Request $request): JsonResponse
    {
        // Implemented in T-M5-014.
        return $this->respond(['media' => []], 'OK', 200);
    }
}
