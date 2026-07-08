<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Controllers\Api;

use App\Modules\Moderation\DTO\ReviewReportDto;
use App\Modules\Moderation\Http\Requests\StoreBulkMergeRequest;
use App\Modules\Moderation\Http\Requests\StoreReviewRequest;
use App\Modules\Moderation\Services\ModerationService;
use App\Modules\Moderation\Http\Resources\ModeratorReportDetailResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ModerationActionsController.
 *
 * The four moderator-decision endpoints. Each maps to
 * a single ModerationService call and returns the
 * refreshed ReportResource on success.
 *
 *   POST /api/v1/moderator/reports/{report}/review
 *     - body: { decision, remarks, override_ai, ... }
 *     - decision ∈ approve | reject | merge | escalate
 *
 *   POST /api/v1/moderator/reports/{report}/merge
 *     - body: { duplicate_report_ids: [..], reason_code, remarks }
 *     - canonical is the route's `{report}` segment
 *
 *   POST /api/v1/moderator/reports/{report}/reject
 *     - shortcut for `review` with decision=reject
 *
 *   POST /api/v1/moderator/reports/{report}/escalate
 *     - shortcut for `review` with decision=escalate
 *
 * Per docs/05 §8 the response is the standard envelope
 * (200 + `ReportResource` body). 422 surfaces on bad
 * input. 403 on non-moderator actors.
 */
class ModerationActionsController extends BaseController
{
    public function __construct(
        private readonly ModerationService $service,
    ) {}

    /**
     * POST /api/v1/moderator/reports/{report}/review
     */
    public function review(StoreReviewRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOrFail($reportId);
        $this->authorize('review', $report);

        $dto = $request->toDto();
        $updated = $this->service->review($report, $dto, $request->user());

        return $this->respond([
            'report' => (new ModeratorReportDetailResource($updated))->resolve($request),
        ]);
    }

    /**
     * POST /api/v1/moderator/reports/{report}/merge
     * Bulk merge of duplicate ids into the canonical.
     */
    public function merge(StoreBulkMergeRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOrFail($reportId);
        $this->authorize('merge', $report);

        $merged = $this->service->merge(
            canonicalId: $report->id,
            duplicateIds: array_values(array_unique((array) $request->validated('duplicate_report_ids'))),
            remarks: $request->validated('remarks'),
            reasonCode: $request->validated('reason_code'),
            moderator: $request->user(),
        );

        return $this->respond([
            'merged_count' => count($merged),
            'merged_report_ids' => $merged,
        ]);
    }

    /**
     * POST /api/v1/moderator/reports/{report}/reject
     */
    public function reject(StoreReviewRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOrFail($reportId);
        $this->authorize('reject', $report);

        // The shortcut endpoint accepts the same wire shape as
        // `review` minus the `decision` field; the controller
        // sets the decision itself.
        $validated = $request->validated();
        $validated['decision'] = ReviewReportDto::DECISION_REJECT;
        $dto = ReviewReportDto::fromArray($validated);

        $updated = $this->service->review($report, $dto, $request->user());

        return $this->respond([
            'report' => (new ModeratorReportDetailResource($updated))->resolve($request),
        ]);
    }

    /**
     * POST /api/v1/moderator/reports/{report}/escalate
     */
    public function escalate(StoreReviewRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOrFail($reportId);
        $this->authorize('escalate', $report);

        $validated = $request->validated();
        $validated['decision'] = ReviewReportDto::DECISION_ESCALATE;
        $dto = ReviewReportDto::fromArray($validated);

        $updated = $this->service->review($report, $dto, $request->user());

        return $this->respond([
            'report' => (new ModeratorReportDetailResource($updated))->resolve($request),
        ]);
    }

    private function findOrFail(string $reportId): Report
    {
        $report = Report::query()->find($reportId);
        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        return $report;
    }
}
