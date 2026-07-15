<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Controllers\Api;

use App\Modules\Departments\Models\Ward;
use App\Modules\Moderation\Http\Resources\ModeratorReportDetailResource;
use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The moderator's review queue.
 *
 *   GET /api/v1/moderator/queue
 *     - paginated cursor list of reports in
 *       `submitted`, `ai_processing`, `pending_moderator`, or `escalated`
 *     - filters: category, ward, district, confidence, date, priority
 *     - sorts by `submitted_at` desc (oldest unhandled first)
 *
 * The same controller backs:
 *   GET /api/v1/moderator/duplicates — duplicate_score > 60
 *   GET /api/v1/moderator/fraud      — fraud_score > 60
 *
 * Per docs/05 §8 the response envelope is the standard
 * `ApiResponse` shape (success / data / meta / pagination).
 *
 * No business logic in the controller — the SQL is read-only
 * composition; the moderator applies decisions through the
 * four `POST /moderator/reports/{id}/{action}` endpoints.
 */
class QueueController extends BaseController
{
    public function __construct() {}

    /**
     * GET /api/v1/moderator/queue
     */
    public function queue(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->baseQueueQuery();

        // Only restrict to the default open-status set when the caller
        // has not asked for a specific status. This lets the moderator
        // UI filter by statuses outside the default queue (e.g. assigned)
        // without the default restriction silently emptying the result.
        if (! $request->has('status')) {
            $query->whereIn('current_status_id', $this->statusIdsFor(['submitted', 'ai_processing', 'pending_moderator', 'escalated']));
        }

        $this->applyFilters($query, $request);
        $this->applySort($query, $request);

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

    /**
     * GET /api/v1/moderator/duplicates
     */
    public function duplicates(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->baseQueueQuery()
            ->whereNotNull('duplicate_score')
            ->where('duplicate_score', '>=', 60.0);

        $this->applyFilters($query, $request);

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

    /**
     * GET /api/v1/moderator/fraud
     */
    public function fraud(Request $request): JsonResponse
    {
        $this->authorize('viewQueue', Report::class);

        $query = $this->baseQueueQuery()
            ->whereNotNull('fraud_score')
            ->where('fraud_score', '>=', 60.0);

        $this->applyFilters($query, $request);

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

    /**
     * GET /api/v1/moderator/reports/{report}
     * The single-report moderation detail view.
     */
    public function show(Request $request, string $reportId): JsonResponse
    {
        $report = Report::query()
            ->with(['status', 'reportType', 'priority', 'location', 'location.ward', 'location.district', 'department', 'statusHistory.fromStatus', 'statusHistory.toStatus'])
            ->find($reportId);

        if ($report === null) {
            return $this->respondError('Report not found', 404, 'NOT_FOUND');
        }
        $this->authorize('viewReport', $report);

        return $this->respond([
            'report' => (new ModeratorReportDetailResource($report))->resolve(),
        ]);
    }

    /**
     * @return Builder<Report>
     */
    private function baseQueueQuery(): Builder
    {
        return Report::query()
            ->with(['status', 'reportType', 'priority', 'location'])
            ->whereNull('reports.deleted_at');
    }

    /**
     * @param  Builder<Report>  $query
     */
    private function applyFilters($query, Request $request): void
    {
        if ($status = $request->query('status')) {
            // The moderator UI filters by the human-readable status code
            // (e.g. "pending_moderator"), optionally as a comma-separated list.
            // When absent, the caller's own status restriction (e.g. the queue's
            // default open-status set) remains in effect.
            $codes = array_values(array_filter(array_map('trim', explode(',', (string) $status))));

            if ($codes !== []) {
                $statusIds = $this->statusIdsFor($codes);
                $query->whereIn('current_status_id', $statusIds);
            }
        }

        if ($category = $request->query('category')) {
            // The moderator UI filters by the human-readable report type
            // code (e.g. "road_damage"), not the UUID primary key — resolve
            // it, falling back to treating the value as a raw id.
            $categoryId = ReportType::query()->where('code', (string) $category)->value('id') ?? (string) $category;
            $query->where('report_type_id', $categoryId);
        }

        if ($priority = $request->query('priority')) {
            $query->where('priority_id', (string) $priority);
        }

        if ($ward = $request->query('ward')) {
            // Wards do not have a `code` column; they are identified by
            // `ward_number` (and name). Accept "12", "W-12", or a raw UUID.
            $wardValue = (string) $ward;
            $wardNumber = is_numeric($wardValue) ? (int) $wardValue : null;

            if ($wardNumber === null && preg_match('/^W-?(\d+)$/i', $wardValue, $matches)) {
                $wardNumber = (int) $matches[1];
            }

            if ($wardNumber !== null) {
                $wardIds = Ward::query()->where('ward_number', $wardNumber)->pluck('id')->all();

                if ($wardIds !== []) {
                    $query->whereHas('location', function ($q) use ($wardIds): void {
                        $q->whereIn('ward_id', $wardIds);
                    });
                }
            } else {
                $query->whereHas('location', function ($q) use ($wardValue): void {
                    $q->where('ward_id', $wardValue);
                });
            }
        }

        if ($district = $request->query('district')) {
            $query->whereHas('location', function ($q) use ($district): void {
                $q->where('district_id', (string) $district);
            });
        }

        if ($request->has('confidence_min')) {
            $query->where('ai_confidence', '>=', (float) $request->query('confidence_min'));
        }

        if ($request->has('confidence_max')) {
            $query->where('ai_confidence', '<=', (float) $request->query('confidence_max'));
        }

        if ($confidence = $request->query('confidence')) {
            // Legacy single-value form: allow `>=`/`<=` operator prefixes.
            if (str_starts_with((string) $confidence, '>=')) {
                $query->where('ai_confidence', '>=', (float) substr((string) $confidence, 2));
            } elseif (str_starts_with((string) $confidence, '<=')) {
                $query->where('ai_confidence', '<=', (float) substr((string) $confidence, 2));
            } else {
                $query->where('ai_confidence', '=', (float) $confidence);
            }
        }

        if ($from = $request->query('from')) {
            $query->where('submitted_at', '>=', (string) $from);
        }

        if ($to = $request->query('to')) {
            $query->where('submitted_at', '<=', (string) $to);
        }
    }

    /**
     * @param  Builder<Report>  $query
     */
    private function applySort($query, Request $request): void
    {
        $sort = (string) $request->query('sort', 'submitted_desc');
        match ($sort) {
            'submitted_asc' => $query->orderBy('submitted_at')->orderBy('id'),
            'confidence_desc' => $query->orderByDesc('ai_confidence')->orderByDesc('submitted_at'),
            'priority_desc' => $query
                ->leftJoin('report_priorities', 'reports.priority_id', '=', 'report_priorities.id')
                ->orderByDesc('report_priorities.sort_order')
                ->orderByDesc('reports.submitted_at'),
            default => $query->orderByDesc('submitted_at')->orderByDesc('id'),
        };
    }

    /**
     * @param  list<string>  $codes
     * @return list<string>
     */
    private function statusIdsFor(array $codes): array
    {
        $ids = ReportStatus::query()->whereIn('code', $codes)->pluck('id')->all();

        /** @var list<string> $ids */
        return $ids;
    }
}
