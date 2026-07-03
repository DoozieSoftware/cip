<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\DTO\SubmitReportDto;
use App\Modules\Reports\Models\Location;
use App\Modules\Shared\Exceptions\ApiException;

/**
 * LocationService per docs/11 §12.
 *
 * Owns the business rules for `Location` creation:
 *  - lat/lng range validation (-90..90, -180..180)
 *  - accuracy threshold (we accept any non-null accuracy ≤ 100m
 *    without flagging; > 100m triggers INVALID_GPS_LOW_ACCURACY)
 *  - speed sanity (we flag speeds > 200 m/s as IMPOSSIBLE_SPEED)
 *  - reverse-geocoding: stores coordinates as the address until
 *    a real reverse-geocoding provider is wired
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

        $location = new Location;
        $location->latitude = $dto->latitude;
        $location->longitude = $dto->longitude;
        $location->altitude = $dto->altitude;
        $location->accuracy = $dto->accuracy;
        $location->heading = $dto->heading;
        $location->speed = $dto->speed;
        $location->gps_provider = $dto->gpsProvider;
        $location->captured_at = $dto->capturedAt ?? now();
        $location->address = $this->reverseGeocode($dto->latitude, $dto->longitude);
        $location->save();

        return $location;
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

    private function reverseGeocode(float $lat, float $lng): string
    {
        return sprintf('%.4f, %.4f', $lat, $lng);
    }
}
