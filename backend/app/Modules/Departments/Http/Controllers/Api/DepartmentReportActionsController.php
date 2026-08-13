<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Http\Requests\CompleteDepartmentTaskRequest;
use App\Modules\Departments\Http\Requests\StoreDepartmentActionRequest;
use App\Modules\Departments\Http\Requests\StoreInternalNoteRequest;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Services\DepartmentReportService;
use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentReportActionsController
{
    public function __construct(
        private readonly DepartmentReportService $service,
        private readonly DepartmentReportNotesController $notesController,
        private readonly DepartmentReportTaskController $taskController,
        private readonly DepartmentReportProofController $proofController,
    ) {}

    public function accept(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $updated = $this->service->accept($report, $user, $request, $this->expectedWorkflowVersion($request));

        return $this->respond($updated, $request);
    }

    public function start(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $updated = $this->service->start($report, $user, $request, $this->expectedWorkflowVersion($request));

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
        $updated = $this->service->resolve(
            $report,
            $user,
            $request,
            is_string($note) ? $note : null,
            $this->expectedWorkflowVersion($request),
        );

        return $this->respond($updated, $request);
    }

    public function close(Report $report, StoreDepartmentActionRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $note = $request->input('note');
        $updated = $this->service->close(
            $report,
            $user,
            $request,
            is_string($note) ? $note : null,
            $this->expectedWorkflowVersion($request),
        );

        return $this->respond($updated, $request);
    }

    public function completeTask(
        Report $report,
        ReportAssignment $assignment,
        CompleteDepartmentTaskRequest $request,
    ): JsonResponse {
        return $this->taskController->completeTask($report, $assignment, $request);
    }

    public function uploadProof(Report $report, UploadMediaRequest $request): JsonResponse
    {
        return $this->proofController->uploadProof($report, $request);
    }

    public function addNote(Report $report, StoreInternalNoteRequest $request): JsonResponse
    {
        return $this->notesController->addNote($report, $request);
    }

    public function listNotes(Report $report, Request $request): JsonResponse
    {
        return $this->notesController->listNotes($report, $request);
    }

    private function respond(Report $report, Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => (new DepartmentReportResource($report))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }

    private function expectedWorkflowVersion(StoreDepartmentActionRequest $request): ?int
    {
        $version = $request->validated('expected_workflow_version');

        return is_int($version) ? $version : null;
    }
}
