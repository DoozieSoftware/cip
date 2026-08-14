<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Controllers\Api;

use App\Modules\Departments\Services\DepartmentProofAssignmentService;
use App\Modules\Departments\Services\ProofVerificationService;
use App\Modules\Media\Http\Requests\UploadMediaRequest;
use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\MediaService;
use App\Modules\Reports\Models\Report;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    /**
     * Soft-remove a wrongly-uploaded proof photo. The row is marked
     * is_replaced rather than deleted — the file and DB row survive for
     * audit (chain of custody per the Media model's own is_replaced/
     * version contract), it just drops out of the active gallery and
     * out of future AI proof-review runs.
     */
    public function removeProof(Report $report, string $mediaId, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');

        $media = Media::query()
            ->where('id', $mediaId)
            ->where('report_id', $report->id)
            ->first();

        if ($media === null || $media->role !== 'proof') {
            throw ApiException::notFound('Proof photo');
        }

        if ($media->is_replaced) {
            throw ApiException::validation('This proof photo has already been removed.', []);
        }

        if (! $user->hasAnyRole(['super_admin', 'system'])) {
            $departmentIds = DepartmentScope::memberDepartmentIds($user);

            if ($media->department_id === null || ! in_array((string) $media->department_id, $departmentIds, true)) {
                throw ApiException::forbidden('You cannot remove this proof photo.');
            }
        }

        $media->is_replaced = true;
        $media->save();

        AuditLog::query()->create([
            'user_id' => $user->id,
            'entity' => Media::class,
            'entity_id' => $media->id,
            'action' => 'media.proof_removed',
            'before' => ['is_replaced' => false],
            'after' => ['is_replaced' => true],
            'ip' => null,
            'device_fingerprint' => null,
            'request_id' => $request->attributes->get('trace_id'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Proof photo removed',
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
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
