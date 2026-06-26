<?php

declare(strict_types=1);

namespace App\Modules\Departments\Repositories;

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Read access to the geography tree (country → state →
 * district → city → zone → ward).
 *
 * Pure data access. The service composes the
 * `GeographyRepository` with the per-level repositories
 * (Country, State, District, City, Zone, Ward) — there is
 * intentionally no `create` here; each level owns its
 * create/update path.
 */
class GeographyRepository
{
    /**
     * @return Builder<Country>
     */
    public function countries(): Builder
    {
        return Country::query();
    }

    /**
     * @return Builder<State>
     */
    public function statesByCountry(string $countryId): Builder
    {
        return State::query()->where('country_id', $countryId);
    }

    /**
     * @return Builder<District>
     */
    public function districtsByState(string $stateId): Builder
    {
        return District::query()->where('state_id', $stateId);
    }

    /**
     * @return Builder<City>
     */
    public function citiesByDistrict(string $districtId): Builder
    {
        return City::query()->where('district_id', $districtId);
    }

    /**
     * @return Builder<Zone>
     */
    public function zonesByCity(string $cityId): Builder
    {
        return Zone::query()->where('city_id', $cityId);
    }

    /**
     * @return Builder<Ward>
     */
    public function wardsByZone(string $zoneId): Builder
    {
        return Ward::query()->where('zone_id', $zoneId);
    }

    /**
     * @return Builder<Ward>
     */
    public function wardsByCity(string $cityId): Builder
    {
        return Ward::query()->where('city_id', $cityId);
    }

    /**
     * @return LengthAwarePaginator<int, mixed>
     */
    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     * @param  Builder<TModel>  $query
     * @return LengthAwarePaginator<int, TModel>
     */
    public function paginate(Builder $query, int $perPage = 100): LengthAwarePaginator
    {
        return $query->orderBy('name')->paginate($perPage);
    }

    /**
     * Find a single ward by id, eager-loading the geography
     * chain. Used by the point-in-polygon check.
     */
    public function findWard(string $id): ?Ward
    {
        return Ward::query()->find($id);
    }
}
