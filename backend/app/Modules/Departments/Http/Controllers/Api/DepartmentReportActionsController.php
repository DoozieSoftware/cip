<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Departments\Http\Requests\StoreDepartmentActionRequest;
use App\Modules\Departments\Http\Requests\StoreInternalNoteRequest;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Http\Resources\InternalNoteResource;
use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Reports\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentReportActionsController extends Controller
{
    public function __construct(private readonly DepartmentReportService $service) {}

    public function accept(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $updated = $this->service->accept($report, $request->user(), $request);
        return $this->respond($updated, $request);
    }

    public function start(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $updated = $this->service->start($report, $request->user(), $request);
        return $this->respond($updated, $request);
    }

    public function progress(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $updated = $this->service->progress($report, $request->user(), $request, $request->input('note'));
        return $this->respond($updated, $request);
    }

    public function resolve(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $updated = $this->service->resolve($report, $request->user(), $request, $request->input('note'));
        return $this->respond($updated, $request);
    }

    public function close(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $updated = $this->service->close($report, $request->user(), $request, $request->input('note'));
        return $this->respond($updated, $request);
    }

    public function addNote(Report $report, StoreInternalNoteRequest $request): JsonResponse
    {
        $note = $this->service->addNote($report, $request->user(), (string) $request->input('body'), $request);
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
