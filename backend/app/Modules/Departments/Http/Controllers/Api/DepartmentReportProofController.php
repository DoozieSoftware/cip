<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Services\DepartmentProofAssignmentService;
use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class DepartmentReportProofController
{
    public function __construct(
        private readonly MediaService $mediaService,
        private readonly DepartmentProofAssignmentService $assignments,
    ) {}

    public function uploadProof(Report $report, UploadMediaRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $assignmentId = $request->validated('assignment_id');
        $departmentId = $request->validated('department_id');
        $assignment = $this->assignments->resolve(
            $report,
            $user,
            is_string($assignmentId) ? $assignmentId : null,
            is_string($departmentId) ? $departmentId : null,
        );
        $files = (array) $request->file('photos', []);

        $created = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $created[] = new MediaResource(
                $this->mediaService->uploadPhoto(
                    $report->id,
                    $file,
                    (string) $user->id,
                    'proof',
                    (string) $assignment->id,
                    (string) $assignment->department_id,
                ),
            );
        }

        return response()->json([
            'success' => true,
            'data' => ['media' => $created],
            'message' => 'Proof photos uploaded',
            'trace_id' => $request->attributes->get('trace_id'),
        ], 201);
    }
}
