<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Controllers\Api;

use App\Modules\Moderation\Http\Resources\ModeratorReportDetailResource;
use App\Modules\Moderation\Services\ModerationQueueService;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Repositories\ReportRepository;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QueueController extends BaseController
{
    public function __construct(
        private readonly ModerationQueueService $queueService,
        private readonly ReportRepository $repository,
    ) {}

    public function queue(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->queueService->baseQueueQuery();

        if (! $request->has('status')) {
            $query->whereIn('current_status_id', $this->queueService->statusIdsFor(['submitted', 'ai_processing', 'pending_moderator', 'escalated']));
        }

        $this->queueService->applyFilters($query, $request);
        $this->queueService->applySort($query, $request);

        $paginator = $query->cursorPaginate(
            perPage: (int) min(100, max(1, (int) $request->query('per_page', 20))),
            cursor: $request->query('cursor'),
        );

        return $this->respond([
            'items' => ReportResource::collection($paginator->items())->resolve(),
            'next_cursor' => $paginator->nextCursor()?->encode(),
            'prev_cursor' => $paginator->previousCursor()?->encode(),
        ]);
    }

    public function duplicates(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->queueService->baseQueueQuery()
            ->whereNotNull('duplicate_score')
            ->where('duplicate_score', '>=', 60.0);

        $this->queueService->applyFilters($query, $request);

        $query->orderByDesc('duplicate_score')->orderByDesc('submitted_at');

        $paginator = $query->cursorPaginate(
            perPage: (int) min(100, max(1, (int) $request->query('per_page', 20))),
            cursor: $request->query('cursor'),
        );

        return $this->respond([
            'items' => ReportResource::collection($paginator->items())->resolve(),
            'next_cursor' => $paginator->nextCursor()?->encode(),
            'prev_cursor' => $paginator->previousCursor()?->encode(),
        ]);
    }

    public function fraud(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->queueService->baseQueueQuery()
            ->whereNotNull('fraud_score')
            ->where('fraud_score', '>=', 60.0);

        $this->queueService->applyFilters($query, $request);

        $query->orderByDesc('fraud_score')->orderByDesc('submitted_at');

        $paginator = $query->cursorPaginate(
            perPage: (int) min(100, max(1, (int) $request->query('per_page', 20))),
            cursor: $request->query('cursor'),
        );

        return $this->respond([
            'items' => ReportResource::collection($paginator->items())->resolve(),
            'next_cursor' => $paginator->nextCursor()?->encode(),
            'prev_cursor' => $paginator->previousCursor()?->encode(),
        ]);
    }

    public function show(Request $request, string $reportId): JsonResponse
    {
        $report = $this->repository->findByIdWithRelations($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'NOT_FOUND');
        }
        $this->authorize('viewReport', $report);

        return $this->respond([
            'report' => (new ModeratorReportDetailResource($report))->resolve(),
        ]);
    }
}
