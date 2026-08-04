<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Http\Requests\StoreDepartmentActionRequest;
use App\Modules\Departments\Http\Requests\StoreInternalNoteRequest;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Http\Resources\InternalNoteResource;
use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class DepartmentReportActionsController extends Controller
{
    public function __construct(
        private readonly DepartmentReportService $service,
        private readonly MediaService $mediaService,
    ) {}

    public function accept(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $updated = $this->service->accept($report, $user, $request);

        return $this->respond($updated, $request);
    }

    public function start(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $updated = $this->service->start($report, $user, $request);

        return $this->respond($updated, $request);
    }

    public function progress(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $note = $request->input('note');
        $updated = $this->service->progress($report, $user, $request, is_string($note) ? $note : null);

        return $this->respond($updated, $request);
    }

    public function resolve(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $note = $request->input('note');
        $updated = $this->service->resolve($report, $user, $request, is_string($note) ? $note : null);

        return $this->respond($updated, $request);
    }

    public function close(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $note = $request->input('note');
        $updated = $this->service->close($report, $user, $request, is_string($note) ? $note : null);

        return $this->respond($updated, $request);
    }

    /**
     * POST /api/v1/department/reports/{report}/photos
     *
     * Officer proof-of-completion upload. Stored with role `proof`
     * so it is scoped to the department (hidden from citizens),
     * counts against the proof quota — not the citizen evidence
     * quota — and never re-arms the AI pipeline.
     */
    public function uploadProof(Report $report, UploadMediaRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $files = (array) $request->file('photos', []);

        $created = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $created[] = new MediaResource(
                $this->mediaService->uploadPhoto($report->id, $file, (string) $user->id, 'proof'),
            );
        }

        return response()->json([
            'success' => true,
            'data' => ['media' => $created],
            'message' => 'Proof photos uploaded',
            'trace_id' => $request->attributes->get('trace_id'),
        ], 201);
    }

    public function addNote(Report $report, StoreInternalNoteRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $body = $request->input('body');
        $note = $this->service->addNote($report, $user, is_string($body) ? $body : '', $request);

        return response()->json([
            'success' => true,
            'data' => (new InternalNoteResource($note->load('author')))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ], 201);
    }

    public function listNotes(Report $report, Request $request): JsonResponse
    {
        $notes = $report->internalNotes()->with('author')->orderByDesc('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => InternalNoteResource::collection($notes)->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }

    private function respond(Report $report, Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => (new DepartmentReportResource($report))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
