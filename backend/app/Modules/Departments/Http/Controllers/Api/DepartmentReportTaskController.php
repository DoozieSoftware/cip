<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Http\Requests\CompleteDepartmentTaskRequest;
use App\Modules\Departments\Http\Resources\DepartmentReportResource;
use App\Modules\Departments\Services\DepartmentTaskService;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;

class DepartmentReportTaskController
{
    public function __construct(
        private readonly DepartmentTaskService $taskService,
    ) {}

    public function completeTask(
        Report $report,
        ReportAssignment $assignment,
        CompleteDepartmentTaskRequest $request,
    ): JsonResponse {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        $note = $request->input('note');
        $updated = $this->taskService->complete(
            $report,
            $assignment,
            $user,
            $request,
            is_string($note) ? $note : null,
        );

        return response()->json([
            'success' => true,
            'data' => (new DepartmentReportResource($updated))->resolve($request),
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
