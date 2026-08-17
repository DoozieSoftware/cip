<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Services;

use App\Modules\Departments\Models\Ward;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;

class ModerationQueueService
{
    /**
     * @return Builder<Report>
     */
    public function baseQueueQuery(): Builder
    {
        return Report::query()
            ->with(['status', 'reportType', 'priority', 'location', 'department'])
            ->withCount('media')
            ->whereNull('reports.deleted_at');
    }

    /**
     * @param  Builder<Report>  $query
     */
    public function applyFilters(Builder $query, Request $request): void
    {
        if ($status = $request->query('status')) {
            $codes = array_values(array_filter(array_map('trim', explode(',', (string) $status))));

            if ($codes !== []) {
                $statusIds = $this->statusIdsFor($codes);
                $query->whereIn('current_status_id', $statusIds);
            }
        }

        if ($category = $request->query('category')) {
            $categoryId = ReportType::query()->where('code', (string) $category)->value('id') ?? (string) $category;
            $query->where('report_type_id', $categoryId);
        }

        if ($priority = $request->query('priority')) {
            $query->where('priority_id', (string) $priority);
        }

        if ($ward = $request->query('ward')) {
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
    public function applySort(Builder $query, Request $request): void
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
    public function statusIdsFor(array $codes): array
    {
        $ids = ReportStatus::query()->whereIn('code', $codes)->pluck('id')->all();

        /** @var list<string> $ids */
        return $ids;
    }

    /**
     * Include proof reviews in the normal moderator queue. These reports stay
     * in resolved_pending_verification so citizens can still confirm or
     * dispute the fix, while the moderator can close weak/mismatched proof.
     *
     * @param  Builder<Report>  $query
     */
    public function applyDefaultQueueScope(Builder $query): void
    {
        $statusIds = $this->statusIdsFor(['submitted', 'ai_processing', 'pending_moderator', 'escalated']);
        $proofStatusId = $this->statusIdsFor(['resolved_pending_verification']);

        $query->where(function (Builder $scope) use ($statusIds, $proofStatusId): void {
            $scope->whereIn('current_status_id', $statusIds)
                ->orWhere(function (Builder $proofScope) use ($proofStatusId): void {
                    $proofScope
                        ->whereIn('current_status_id', $proofStatusId)
                        ->whereExists(function (QueryBuilder $proofQuery): void {
                            $proofQuery->selectRaw('1')
                                ->from('report_proof_verifications')
                                ->join('media as proof_media', 'proof_media.id', '=', 'report_proof_verifications.proof_media_id')
                                ->whereColumn('report_proof_verifications.report_id', 'reports.id')
                                ->where('proof_media.is_replaced', false);
                        });
                });
        });
    }
}
