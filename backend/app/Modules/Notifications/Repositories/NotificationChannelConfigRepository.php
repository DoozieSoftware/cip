<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Repositories;

use App\Modules\Notifications\Models\NotificationChannelConfig;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class NotificationChannelConfigRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function search(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        return $this->buildQuery($filters)
            ->orderBy('channel')->orderBy('display_name')
            ->paginate(perPage: $perPage);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<NotificationChannelConfig>
     */
    public function buildQuery(array $filters): Builder
    {
        $q = NotificationChannelConfig::query();

        if (isset($filters['channel']) && is_string($filters['channel']) && $filters['channel'] !== '') {
            $q->where('channel', $filters['channel']);
        }

        if (array_key_exists('active', $filters)) {
            $q->where('active', (bool) $filters['active']);
        }

        if (isset($filters['q']) && is_string($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.$filters['q'].'%';
            $q->where(static function (Builder $sub) use ($needle): void {
                $sub->where('code', 'like', $needle)
                    ->orWhere('display_name', 'like', $needle);
            });
        }

        return $q;
    }
}
