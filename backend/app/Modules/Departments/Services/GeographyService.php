<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\DTOs\GeographyDTO;
use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Departments\Models\Zone;
use App\Modules\Departments\Repositories\GeographyRepository;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * GeographyService per docs/04 §8 and docs/09 §7.
 *
 * - Read-side: tree lookups, paginated helper accessors
 *   (states-by-country, …, wards-by-city).
 * - Write-side: level-aware upsert via `GeographyDTO`.
 *   Each level's per-row validation lives in the
 *   `Model::rules()` accessor (or its Form Request at the
 *   HTTP boundary).
 *
 * The geography tree terminates at the ward; the ward's
 * `boundary_polygon` is application-level WKT (D-020).
 */
class GeographyService
{
    public function __construct(
        private readonly GeographyRepository $repository,
    ) {}

    /**
     * @return LengthAwarePaginator<int, State>
     */
    public function getStatesByCountry(string $countryId, int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->statesByCountry($countryId), $perPage);
    }

    /**
     * @return LengthAwarePaginator<int, District>
     */
    public function getDistrictsByState(string $stateId, int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->districtsByState($stateId), $perPage);
    }

    /**
     * @return LengthAwarePaginator<int, City>
     */
    public function getCitiesByDistrict(string $districtId, int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->citiesByDistrict($districtId), $perPage);
    }

    /**
     * @return LengthAwarePaginator<int, Zone>
     */
    public function getZonesByCity(string $cityId, int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->zonesByCity($cityId), $perPage);
    }

    /**
     * @return LengthAwarePaginator<int, Ward>
     */
    public function getWardsByCity(string $cityId, int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->wardsByCity($cityId), $perPage);
    }

    /**
     * @return LengthAwarePaginator<int, Country>
     */
    public function listCountries(int $perPage = 100): LengthAwarePaginator
    {
        return $this->repository->paginate($this->repository->countries(), $perPage);
    }

    /**
     * Upsert a geography row at the requested level. Returns
     * the persisted model instance. Each level is routed
     * to its own model class; the DTO carries the
     * level-specific extras (e.g. ward `boundary_polygon`,
     * country `iso2` / `iso3` / `phone_code`).
     */
    public function upsert(GeographyDTO $dto): Country|State|District|City|Zone|Ward
    {
        return match ($dto->level) {
            'country' => $this->upsertCountry($dto),
            'state' => $this->upsertState($dto),
            'district' => $this->upsertDistrict($dto),
            'city' => $this->upsertCity($dto),
            'zone' => $this->upsertZone($dto),
            'ward' => $this->upsertWard($dto),
            default => throw ApiException::validation("Unknown geography level '{$dto->level}'."),
        };
    }

    private function upsertCountry(GeographyDTO $dto): Country
    {
        if ($dto->code === null) {
            throw ApiException::validation('country.iso2 is required.');
        }

        return Country::query()->updateOrCreate(
            ['iso2' => strtoupper($dto->code)],
            ['name' => $dto->name, 'active' => $dto->active, ...$this->stringifyScalars($dto->attributes)],
        );
    }

    private function upsertState(GeographyDTO $dto): State
    {
        if ($dto->parentId === null || $dto->code === null) {
            throw ApiException::validation('state.country_id and state.code are required.');
        }

        return State::query()->updateOrCreate(
            ['country_id' => $dto->parentId, 'code' => strtoupper($dto->code)],
            ['name' => $dto->name, 'active' => $dto->active, ...$this->stringifyScalars($dto->attributes)],
        );
    }

    private function upsertDistrict(GeographyDTO $dto): District
    {
        if ($dto->parentId === null || $dto->code === null) {
            throw ApiException::validation('district.state_id and district.code are required.');
        }

        return District::query()->updateOrCreate(
            ['state_id' => $dto->parentId, 'code' => strtoupper($dto->code)],
            ['name' => $dto->name, 'active' => $dto->active, ...$this->stringifyScalars($dto->attributes)],
        );
    }

    private function upsertCity(GeographyDTO $dto): City
    {
        if ($dto->parentId === null || $dto->code === null) {
            throw ApiException::validation('city.district_id and city.code are required.');
        }

        return City::query()->updateOrCreate(
            ['district_id' => $dto->parentId, 'code' => strtoupper($dto->code)],
            ['name' => $dto->name, 'active' => $dto->active, ...$this->stringifyScalars($dto->attributes)],
        );
    }

    private function upsertZone(GeographyDTO $dto): Zone
    {
        if ($dto->parentId === null || $dto->code === null) {
            throw ApiException::validation('zone.city_id and zone.code are required.');
        }

        return Zone::query()->updateOrCreate(
            ['city_id' => $dto->parentId, 'code' => strtoupper($dto->code)],
            ['name' => $dto->name, 'active' => $dto->active, ...$this->stringifyScalars($dto->attributes)],
        );
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, string|int|bool|null>
     */
    private function stringifyScalars(array $values): array
    {
        $out = [];
        foreach ($values as $k => $v) {
            if (is_scalar($v) || $v === null) {
                $out[$k] = is_bool($v) ? (int) $v : (is_null($v) ? null : (string) $v);
            }
        }
        return $out;
    }

    private function upsertWard(GeographyDTO $dto): Ward
    {
        if ($dto->parentId === null) {
            throw ApiException::validation('ward.city_id is required.');
        }
        $rawWardNumber = $dto->attributes['ward_number'] ?? null;
        $wardNumber = is_numeric($rawWardNumber) ? (int) $rawWardNumber : null;

        if ($wardNumber === null || $wardNumber < 1) {
            throw ApiException::validation('ward.ward_number is required and must be a positive integer.');
        }

        $extras = $this->stringifyScalars($dto->attributes);

        return Ward::query()->updateOrCreate(
            ['city_id' => $dto->parentId, 'ward_number' => $wardNumber],
            [
                'zone_id' => $extras['zone_id'] ?? null,
                'name' => $dto->name,
                'municipality' => $extras['municipality'] ?? null,
                'boundary_polygon' => $extras['boundary_polygon'] ?? null,
                'active' => $dto->active,
            ],
        );
    }
}
