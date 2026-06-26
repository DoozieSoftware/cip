<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Controllers\Api;

use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
     *
     * Per docs/05 §14 the report may have at most one video.
     * The duplicate guard is enforced by MediaService and
     * surfaces as a 409 with code VIDEO_ALREADY_PRESENT.
     *
     * The duration window (3 – 300 s) is enforced
     * server-side via MediaService::assertVideoDurationWindow
     * when the client supplies a `duration_seconds` hint
     * (typically read from the file on the device before
     * upload). When the client does not supply a hint, the
     * full ExtractVideoMetadataJob runs and a 422 is raised
     * later if the duration turns out to be out of range.
     */
    public function uploadVideo(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $userId = (string) $request->user('sanctum')->id;
        $file = $request->file('video');

        $duration = $request->input('duration_seconds');

        if (is_numeric($duration)) {
            $this->service->assertVideoDurationWindow((int) $duration);
        }

        $created = $this->service->uploadVideo($reportId, $file, $userId);

        return $this->respond(
            ['media' => new MediaResource($created)],
            'Video uploaded',
            201,
        );
    }

    /**
     * GET /api/v1/reports/{id}/media
     *
     * Returns every media row attached to the report. Owners
     * (the report's citizen) and staff (moderator / super_admin
     * / department) can list; everyone else gets 404 via the
     * ReportPolicy. The wire format uses MediaResource, which
     * includes a `signed_url` (TTL 15 min) for the citizen and
     * the staff who are not the citizen; the full storage path
     * is only ever returned to super_admin via the
     * `include_storage_path=true` query param so internal
     * tooling can audit the storage layout.
     */
    public function index(string $reportId, Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $report = Report::query()->find($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'REPORT_NOT_FOUND');
        }

        $this->authorize('view', $report);

        $media = Media::query()
            ->where('report_id', $reportId)
            ->orderBy('created_at')
            ->get();

        $isStaff = method_exists($user, 'hasRole') && $user->hasRole('super_admin');
        $includePath = $isStaff && $request->boolean('include_storage_path');

        $items = $media->map(function (Media $m) use ($request, $isStaff, $includePath): array {
            $row = (new MediaResource($m))->resolve($request);
            $row['signed_url'] = URL::temporarySignedRoute(
                'api.v1.media.serve',
                now()->addMinutes(15),
                ['media' => $m->id],
            );
            $row['signed_url_expires_at'] = now()->addMinutes(15)->toIso8601String();

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

    /**
     * GET /api/v1/media/{media}/serve
     *
     * Public, signature-gated stream of a media asset. The
     * signature in the query string is the auth — once the
     * TTL expires the route returns 403 (Laravel's
     * SignatureMiddleware handles this automatically via
     * temporarySignedRoute).
     */
    public function serve(string $media): StreamedResponse|BinaryFileResponse|JsonResponse
    {
        $row = Media::query()->find($media);

        if ($row === null) {
            return $this->respondError('Media not found', 404, 'NOT_FOUND');
        }

        $disk = Storage::disk($row->storage_disk);

        if (! $disk->exists($row->storage_path)) {
            return $this->respondError('Media bytes missing on storage', 410, 'NOT_FOUND');
        }

        $abs = $disk->path($row->storage_path);

        return response()->file($abs, [
            'Content-Type' => $row->mime,
            'Cache-Control' => 'private, max-age=300',
        ]);
    }
}
