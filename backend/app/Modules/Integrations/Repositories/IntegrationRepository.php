<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Repositories;

use App\Modules\Integrations\Models\Integration;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Read-side repository for `integrations` per `docs/12` §34.
 *
 * Pure query helpers — no business logic. Service layer
 * (IntegrationAdminService) owns validation, audit, and
 * write semantics.
 */
class IntegrationRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $q = $this->buildQuery($filters);

        return $q->orderBy('display_name')->paginate(perPage: $perPage);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Integration>
     */
    public function buildQuery(array $filters): Builder
    {
        $q = Integration::query();

        if (isset($filters['q']) && is_string($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.$filters['q'].'%';
            $q->where(static function (Builder $sub) use ($needle): void {
                $sub->where('code', 'like', $needle)
                    ->orWhere('display_name', 'like', $needle)
                    ->orWhere('provider', 'like', $needle);
            });
        }

        if (isset($filters['status']) && is_string($filters['status']) && $filters['status'] !== '') {
            $q->where('status', $filters['status']);
        }

        if (isset($filters['provider']) && is_string($filters['provider']) && $filters['provider'] !== '') {
            $q->where('provider', $filters['provider']);
        }

        return $q;
    }
}
