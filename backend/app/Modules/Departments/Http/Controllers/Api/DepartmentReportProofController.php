<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Services\DepartmentProofAssignmentService;
use App\Modules\Departments\Services\ProofVerificationService;
use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class DepartmentReportProofController
{
    public function __construct(
        private readonly MediaService $mediaService,
        private readonly DepartmentProofAssignmentService $assignments,
        private readonly ProofVerificationService $proofVerification,
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
        $capture = $this->captureHints($request);

        $created = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $media = $this->mediaService->uploadPhoto(
                $report->id,
                $file,
                (string) $user->id,
                'proof',
                (string) $assignment->id,
                (string) $assignment->department_id,
                $capture === [] ? null : ['capture' => $capture],
            );

            $this->proofVerification->verify($media);
            $created[] = new MediaResource($media);
        }

        return response()->json([
            'success' => true,
            'data' => ['media' => $created],
            'message' => 'Proof photos uploaded',
            'trace_id' => $request->attributes->get('trace_id'),
        ], 201);
    }

    /** @return array<string, mixed> */
    private function captureHints(UploadMediaRequest $request): array
    {
        $validated = $request->validated();
        $lat = $validated['capture_latitude'] ?? null;
        $lng = $validated['capture_longitude'] ?? null;

        if (! is_numeric($lat) || ! is_numeric($lng)) {
            throw ApiException::validation(
                'Proof photos must include the officer device location.',
                [
                    'capture_latitude' => ['Capture the current location before uploading proof.'],
                    'capture_longitude' => ['Capture the current location before uploading proof.'],
                ],
            );
        }

        return [
            'latitude' => (float) $lat,
            'longitude' => (float) $lng,
            'accuracy' => is_numeric($validated['capture_accuracy'] ?? null) ? (float) $validated['capture_accuracy'] : null,
            'altitude' => is_numeric($validated['capture_altitude'] ?? null) ? (float) $validated['capture_altitude'] : null,
            'heading' => is_numeric($validated['capture_heading'] ?? null) ? (float) $validated['capture_heading'] : null,
            'speed' => is_numeric($validated['capture_speed'] ?? null) ? (float) $validated['capture_speed'] : null,
            'captured_at' => is_string($validated['capture_timestamp'] ?? null) ? $validated['capture_timestamp'] : now()->toIso8601String(),
            'provider' => 'browser_geolocation',
        ];
    }
}
