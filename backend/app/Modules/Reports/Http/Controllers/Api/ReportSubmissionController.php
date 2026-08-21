<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Http\Requests\SubmitReportRequest;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Reports\Services\EvidenceManifestService;
use App\Modules\Reports\Services\ReportService;
use App\Modules\Reports\Services\ReportSubmissionAccessService;
use App\Modules\Reports\Services\ReportSubmissionFinalizer;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportSubmissionController extends BaseController
{
    public function __construct(
        private readonly ReportRepository $repository,
        private readonly ReportService $service,
        private readonly EvidenceManifestService $evidence,
        private readonly ReportSubmissionAccessService $access,
        private readonly ReportSubmissionFinalizer $finalizer,
    ) {}

    public function store(SubmitReportRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $dto = SubmitReportDto::fromArray([
            ...$request->validated(),
            'citizen_id' => (string) $user->id,
        ]);

        $report = $this->service->createDraftFromSubmission($dto);
        $fresh = $report->fresh();

        if ($fresh === null) {
            throw ApiException::notFound('Complaint');
        }

        return $this->respond(
            (new ReportResource($fresh->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
            'Draft created. Upload the required evidence before finalizing.',
            201,
        );
    }

    public function manifest(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);
        $user = $request->user();

        if ($report === null) {
            throw ApiException::notFound('Complaint');
        }

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }
        $this->access->authorize($user, $report);

        return $this->respond($this->evidence->manifest($report), 'Evidence manifest.');
    }

    /**
     * Finalize one draft after all required evidence is durable and hashed.
     * Idempotency-Key middleware replays successful responses; the status
     * guard below also makes a retry safe when the key was not persisted.
     */
    public function finalize(Request $request, string $id): JsonResponse
    {
        $report = $this->repository->findById($id);
        $user = $request->user();

        if ($report === null) {
            throw ApiException::notFound('Complaint');
        }

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }
        $this->access->authorize($user, $report);
        $result = $this->finalizer->finalize($report, $user);

        return $this->respond(
            (new ReportResource($result->report->load(['location', 'status', 'priority', 'reportType'])))->toArray($request),
            $result->alreadySubmitted ? 'Report already submitted.' : 'Report submitted.',
        );
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        // Preserve the legacy route while enforcing the same evidence gate as
        // the canonical finalization endpoint.
        return $this->finalize($request, $id);
    }
}
