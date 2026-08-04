<?php

declare(strict_types=1);

namespace App\Modules\Reports\Repositories;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * T-M12-003 — read-side repository for `report_types`.
 *
 * Owns the search filters used by the Super Admin
 * `report-types` index screen (`docs/09` §6).
 */
class ReportTypeRepository
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, ReportType>
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $q = ReportType::query();

        if (! empty($filters['q'])) {
            $search = is_string($filters['q']) ? $filters['q'] : '';
            $needle = '%'.$search.'%';
            $q->where(static function ($w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('code', 'like', $needle);
            });
        }

        if (! empty($filters['active'])) {
            $q->where('active', filter_var($filters['active'], FILTER_VALIDATE_BOOLEAN));
        }

        if (! empty($filters['include_trashed'])) {
            $q->withTrashed();
        }

        if (! empty($filters['only_trashed'])) {
            $q->onlyTrashed();
        }

        return $q->orderBy('sort_order')->orderBy('name')->paginate(max(1, min(200, $perPage)));
    }
}
