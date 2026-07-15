<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Controllers\Api;

use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * MediaController per docs/05 §6, §14 and docs/11 §15.
 *
 *  - POST /api/v1/reports/{id}/photos                  : uploadPhotos  (T-M5-012)
 *  - POST /api/v1/reports/{id}/video                   : uploadVideo   (T-M5-013)
 *  - GET  /api/v1/reports/{id}/media                   : index         (T-M5-014)
 *  - GET  /api/v1/reports/{id}/media/{media}/audit     : audit         (T-M5-016)
 *  - GET  /api/v1/media/{media}/serve                  : serve         (T-M5-014)
 *
 * Per AGENTS.md — no business logic here. The service owns
 * the validation, scan, persist, and job-dispatch; the
 * ChainOfCustodyWriter owns the append-only audit log.
 */
class MediaController extends BaseController
{
    public function __construct(
        private readonly MediaService $service,
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    /**
     * POST /api/v1/reports/{id}/photos
     */
    public function uploadPhotos(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $denied = $this->assertCanModifyMedia($request, $reportId);

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

    /**
     * POST /api/v1/reports/{id}/video
     */
    public function uploadVideo(string $reportId, UploadMediaRequest $request): JsonResponse
    {
        $denied = $this->assertCanModifyMedia($request, $reportId);

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

        // Hint to the post-processing job: if ffprobe is
        // missing in this environment, ExtractVideoMetadataJob
        // can fall back to the duration/width/height the
        // citizen's client captured at upload time.
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

    /**
     * Ensure the caller is allowed to attach media to the report.
     *
     * Media uploads are scoped to the report owner (or staff). A
     * citizen must not be able to attach evidence to another
     * citizen's report.
     */
    private function assertCanModifyMedia(Request $request, string $reportId): ?JsonResponse
    {
        $report = Report::query()->find($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'REPORT_NOT_FOUND');
        }

        /** @var User $user */
        $user = $request->user('sanctum');
        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system']);

        if (! $isOwner && ! $isStaff) {
            return $this->respondError('You cannot add media to this report.', 403, 'FORBIDDEN');
        }

        return null;
    }

    /**
     * GET /api/v1/reports/{id}/media
     */
    public function index(string $reportId, Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');
        $report = Report::query()->find($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'REPORT_NOT_FOUND');
        }

        $this->authorize('viewReportMedia', $report);

        $media = Media::query()
            ->where('report_id', $reportId)
            ->orderBy('created_at')
            ->get();

        $isStaff = $user?->hasRole('super_admin') ?? false;
        $includePath = $isStaff && $request->boolean('include_storage_path');

        // Chain-of-custody: write a VIEW row for every
        // media that the caller can see.
        foreach ($media as $m) {
            $this->chainOfCustody->recordFromRequest($m, ChainOfCustodyWriter::EVENT_VIEW, $request);
        }

        $items = $media->map(function (Media $m) use ($request, $includePath): array {
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
     * GET /api/v1/reports/{id}/media/{media}/audit
     */
    public function audit(string $reportId, string $media, Request $request): JsonResponse
    {
        $row = Media::query()->where('id', $media)->where('report_id', $reportId)->first();

        if ($row === null) {
            return $this->respondError('Media not found', 404, 'NOT_FOUND');
        }

        /** @var User|null $user */
        $user = $request->user('sanctum');

        if ($user === null || ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            return $this->respondError('Forbidden', 403, 'FORBIDDEN');
        }

        $history = $this->chainOfCustody->historyFor($media);

        return $this->respond([
            'media_id' => $row->id,
            'audit' => $history->map(fn (MediaAccessLog $r): array => [
                'id' => $r->id,
                'event' => $r->event,
                'actor_id' => $r->actor_id,
                'ip' => $r->ip,
                'user_agent' => $r->user_agent,
                'metadata' => $r->metadata,
                'created_at' => $r->created_at instanceof Carbon ? $r->created_at->toIso8601String() : null,
            ])->all(),
        ], 'OK', 200, ['count' => $history->count()]);
    }

    /**
     * GET /api/v1/media/{media}/serve
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

        // Chain-of-custody: write a DOWNLOAD row. The signed
        // URL is the auth, so we don't have a User here —
        // actor_id stays null and the event captures the IP
        // from the request indirectly (the URL is the
        // artefact). The downloader may carry an
        // authenticated session via a separate cookie; we
        // don't try to recover it here.
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
