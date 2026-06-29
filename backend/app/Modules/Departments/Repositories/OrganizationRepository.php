<?php

declare(strict_types=1);

namespace App\Modules\Departments\Repositories;

use App\Modules\Departments\Models\Organization;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class OrganizationRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        return $this->buildQuery($filters)
            ->orderBy('name')
            ->paginate(perPage: $perPage);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Organization>
     */
    public function buildQuery(array $filters): Builder
    {
        $q = Organization::query();

        if (isset($filters['q']) && is_string($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.$filters['q'].'%';
            $q->where(static function (Builder $sub) use ($needle): void {
                $sub->where('code', 'like', $needle)
                    ->orWhere('name', 'like', $needle)
                    ->orWhere('legal_name', 'like', $needle);
            });
        }

        if (array_key_exists('active', $filters)) {
            $q->where('active', (bool) $filters['active']);
        }

        return $q;
    }
}
