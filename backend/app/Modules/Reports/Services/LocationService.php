<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Departments\Models\Ward;
use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Models\Location;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * LocationService per docs/11 §12.
 *
 * Owns the business rules for `Location` creation:
 *  - lat/lng range validation (-90..90, -180..180)
 *  - accuracy threshold (we accept any non-null accuracy ≤ 100m
 *    without flagging; > 100m triggers INVALID_GPS_LOW_ACCURACY)
 *  - speed sanity (we flag speeds > 200 m/s as IMPOSSIBLE_SPEED)
 *  - address: stores citizen/client-provided road-level text when available;
 *    never stores raw coordinates as a fake address
 *
 * The service is the only path that should mutate `locations`
 * in production. Controllers and seeders both go through it.
 */
class LocationService
{
    private const MAX_ACCURACY_METERS = 100.0;

    private const MAX_SPEED_MS = 200.0;

    public function createFromSubmission(SubmitReportDto $dto): Location
    {
        $this->assertLatLng($dto->latitude, $dto->longitude);
        $this->assertAccuracy($dto->accuracy);
        $this->assertSpeed($dto->speed);

        if ($dto->reporterLatitude !== null && $dto->reporterLongitude !== null) {
            $this->assertLatLng($dto->reporterLatitude, $dto->reporterLongitude);
        }
        $this->assertAccuracy($dto->reporterAccuracy);

        $location = new Location;
        $location->latitude = $dto->latitude;
        $location->longitude = $dto->longitude;
        $location->reporter_latitude = $dto->reporterLatitude;
        $location->reporter_longitude = $dto->reporterLongitude;
        $location->reporter_accuracy = $dto->reporterAccuracy;
        $location->reporter_gps_provider = $dto->reporterGpsProvider;
        $location->reporter_captured_at = $dto->reporterCapturedAt === null
            ? null
            : Carbon::parse($dto->reporterCapturedAt->format(DATE_ATOM));
        $location->altitude = $dto->altitude;
        $location->accuracy = $dto->accuracy;
        $location->heading = $dto->heading;
        $location->speed = $dto->speed;
        $location->gps_provider = $dto->gpsProvider;
        $location->captured_at = $dto->capturedAt === null
            ? now()
            : Carbon::parse($dto->capturedAt->format(DATE_ATOM));
        $location->address = $this->cleanAddress($dto->address);
        $location->save();

        $this->enrichJurisdiction($location);

        return $location;
    }

    /**
     * Resolve ward and district from authoritative GIS boundaries when the
     * MySQL spatial backend is available. Unresolved points remain explicit
     * nulls and can be routed to jurisdiction review.
     */
    private function enrichJurisdiction(Location $location): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        $ward = Ward::query()
            ->with('city')
            ->where('active', true)
            ->whereNotNull('boundary_polygon')
            ->whereRaw('ST_Contains(boundary_polygon, ST_SRID(POINT(?, ?), 4326))', [$location->longitude, $location->latitude])
            ->first();

        if ($ward === null) {
            return;
        }

        $location->ward_id = (string) $ward->id;
        $districtId = $ward->city?->district_id;
        $location->district_id = is_string($districtId) ? $districtId : null;
        $location->saveQuietly();
    }

    private function assertLatLng(float $lat, float $lng): void
    {
        if ($lat < -90.0 || $lat > 90.0) {
            throw new ApiException('INVALID_GPS', 'latitude is out of range (-90..90).', 422);
        }

        if ($lng < -180.0 || $lng > 180.0) {
            throw new ApiException('INVALID_GPS', 'longitude is out of range (-180..180).', 422);
        }
    }

    private function assertAccuracy(?float $accuracy): void
    {
        if ($accuracy === null) {
            return;
        }

        if ($accuracy > self::MAX_ACCURACY_METERS) {
            throw new ApiException(
                'INVALID_GPS_LOW_ACCURACY',
                'GPS accuracy is too low; please retry outdoors.',
                422,
            );
        }

        if ($accuracy < 0.0) {
            throw new ApiException('INVALID_GPS', 'GPS accuracy must be non-negative.', 422);
        }
    }

    private function assertSpeed(?float $speed): void
    {
        if ($speed === null) {
            return;
        }

        if ($speed < 0.0) {
            throw new ApiException('INVALID_GPS', 'GPS speed must be non-negative.', 422);
        }

        if ($speed > self::MAX_SPEED_MS) {
            throw new ApiException(
                'IMPOSSIBLE_SPEED',
                'GPS speed is unrealistic; please retry.',
                422,
            );
        }
    }

    private function cleanAddress(?string $address): ?string
    {
        if ($address === null) {
            return null;
        }

        $trimmed = trim($address);

        if ($trimmed === '' || preg_match('/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/', $trimmed) === 1) {
            return null;
        }

        return $trimmed;
    }
}
