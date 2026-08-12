<?php

declare(strict_types=1);

namespace App\Modules\Reports\Http\Controllers\Api;

use App\Modules\Reports\Http\Requests\StoreCitizenActionRequest;
use App\Modules\Reports\Http\Resources\CitizenReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Services\CitizenReportActionService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * P1-06 — citizen verification and dispute endpoints.
 *
 *   POST /api/v1/citizen/reports/{report}/verify
 *     - citizen confirms the department's resolution; report -> verified.
 *
 *   POST /api/v1/citizen/reports/{report}/dispute
 *     - citizen disputes the resolution; report -> reopened.
 *     - body: { reason?: string } — required when disputing.
 *     - time-bound: only while the verification deadline is open.
 *
 * P1-07 — merge dispute endpoint.
 *
 *   POST /api/v1/citizen/reports/{report}/dispute-merge
 *     - citizen disputes an incorrect merge; report -> pending_moderator.
 *     - body: { reason?: string } — required when disputing a merge.
 */
class CitizenReportActionsController extends BaseController
{
    public function __construct(
        private readonly CitizenReportActionService $service,
    ) {}

    public function verify(StoreCitizenActionRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOwnedReport($request, $reportId);
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $updated = $this->service->verify($report, $user, $this->expectedWorkflowVersion($request));

        return $this->respond([
            'report' => (new CitizenReportResource($updated->load([
                'location',
                'status',
                'priority',
                'reportType',
                'canonicalReport',
                'mergeDisputes',
                'media',
            ])))->toArray($request),
        ]);
    }

    public function dispute(StoreCitizenActionRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOwnedReport($request, $reportId);
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $reason = $request->validated('reason');

        if (! is_string($reason) || trim($reason) === '') {
            throw ApiException::validation('A reason is required when disputing a resolution.', ['reason' => ['Required.']]);
        }

        $updated = $this->service->dispute($report, $user, $reason, $this->expectedWorkflowVersion($request));

        return $this->respond([
            'report' => (new CitizenReportResource($updated->load([
                'location',
                'status',
                'priority',
                'reportType',
                'canonicalReport',
                'mergeDisputes',
                'media',
            ])))->toArray($request),
        ]);
    }

    public function disputeMerge(StoreCitizenActionRequest $request, string $reportId): JsonResponse
    {
        $report = $this->findOwnedReport($request, $reportId);
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $reason = $request->validated('reason');

        if (! is_string($reason) || trim($reason) === '') {
            throw ApiException::validation('A reason is required when disputing a merge.', ['reason' => ['Required.']]);
        }

        $updated = $this->service->disputeMerge($report, $user, $reason, $this->expectedWorkflowVersion($request));

        return $this->respond([
            'report' => (new CitizenReportResource($updated->load([
                'location',
                'status',
                'priority',
                'reportType',
                'canonicalReport',
                'mergeDisputes',
                'media',
            ])))->toArray($request),
        ]);
    }

    private function findOwnedReport(StoreCitizenActionRequest $request, string $reportId): Report
    {
        $report = Report::query()->find($reportId);

        if ($report === null) {
            throw ApiException::notFound('Report');
        }

        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::forbidden('Authentication is required.');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;

        if (! $isOwner) {
            throw ApiException::forbidden('You cannot act on this report.');
        }

        return $report;
    }

    private function expectedWorkflowVersion(StoreCitizenActionRequest $request): ?int
    {
        $version = $request->validated('expected_workflow_version');

        return is_int($version) ? $version : null;
    }
}
