<?php

declare(strict_types=1);

namespace App\Modules\Reports\Repositories;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ReportTypeRepository
{
    /**
     * @return Collection<int, ReportType>
     */
    public function active(): Collection
    {
        return ReportType::query()
            ->where('active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

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
            $q->where(function ($w) use ($needle): void {
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
