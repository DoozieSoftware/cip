<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ReverseGeocodeService
{
    /** @return array{label:string, geocoded:bool} */
    public function resolve(float $latitude, float $longitude): array
    {
        $key = 'public.reverse-geocode:'.number_format($latitude, 5, '.', '').','.number_format($longitude, 5, '.', '');

        return Cache::remember($key, now()->addDay(), function () use ($latitude, $longitude): array {
            $configuredUrl = config('services.geocoder.url', '');
            $baseUrl = is_string($configuredUrl) ? rtrim($configuredUrl, '/') : '';

            if ($baseUrl === '') {
                return ['label' => '', 'geocoded' => false];
            }

            try {
                $response = Http::retry(2, 200, throw: false)->timeout(5)->connectTimeout(2)->withHeaders([
                    'Accept' => 'application/json', 'User-Agent' => 'CIP-ReverseGeocoder/1.0 (privacy-proxy)',
                ])->get($baseUrl, ['lat' => $latitude, 'lon' => $longitude, 'format' => 'jsonv2', 'zoom' => 18]);

                if (! $response->successful()) {
                    Log::warning('Reverse geocoder request failed.', ['status' => $response->status()]);

                    return ['label' => '', 'geocoded' => false];
                }
                $display = $response->json('display_name');

                return is_string($display) && trim($display) !== ''
                    ? ['label' => trim($display), 'geocoded' => true]
                    : ['label' => '', 'geocoded' => false];
            } catch (\Throwable $exception) {
                Log::warning('Reverse geocoder unavailable.', ['exception' => $exception::class]);

                return ['label' => '', 'geocoded' => false];
            }
        });
    }

    /** @return array{label:string,latitude:float|null,longitude:float|null,geocoded:bool} */
    public function search(string $address): array
    {
        $normalized = trim($address);
        $fallback = ['label' => '', 'latitude' => null, 'longitude' => null, 'geocoded' => false];

        if ($normalized === '') {
            return $fallback;
        }

        $key = 'public.forward-geocode:'.hash('sha256', mb_strtolower($normalized));
        $cached = Cache::get($key);

        if (is_array($cached)) {
            $label = $cached['label'] ?? null;
            $latitude = $cached['latitude'] ?? null;
            $longitude = $cached['longitude'] ?? null;

            if (is_string($label) && is_numeric($latitude) && is_numeric($longitude)) {
                return [
                    'label' => $label,
                    'latitude' => (float) $latitude,
                    'longitude' => (float) $longitude,
                    'geocoded' => true,
                ];
            }
        }

        $configuredUrl = config('services.geocoder.search_url', '');
        $url = is_string($configuredUrl) ? trim($configuredUrl) : '';

        if ($url === '') {
            return $fallback;
        }

        try {
            $countryCodes = config('services.geocoder.search_countrycodes', 'in');
            $countryCodes = is_string($countryCodes) ? trim($countryCodes) : '';

            foreach ($this->searchQueries($normalized) as $query) {
                $params = ['q' => $query, 'format' => 'jsonv2', 'limit' => 1];

                if ($countryCodes !== '') {
                    $params['countrycodes'] = $countryCodes;
                }
                $response = Http::retry(2, 200, throw: false)->timeout(5)->connectTimeout(2)->withHeaders([
                    'Accept' => 'application/json', 'User-Agent' => 'CIP-Geocoder/1.0 (privacy-proxy)',
                ])->get($url, $params);

                if (! $response->successful()) {
                    Log::warning('Forward geocoder request failed.', ['status' => $response->status()]);

                    continue;
                }

                $row = $response->json('0');
                $latitude = is_array($row) && is_numeric($row['lat'] ?? null) ? (float) $row['lat'] : null;
                $longitude = is_array($row) && is_numeric($row['lon'] ?? null) ? (float) $row['lon'] : null;
                $label = is_array($row) && is_string($row['display_name'] ?? null)
                    ? trim($row['display_name'])
                    : '';

                if ($latitude === null || $longitude === null || $label === '') {
                    continue;
                }

                $result = [
                    'label' => $label,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'geocoded' => true,
                ];

                Cache::put($key, $result, now()->addDay());

                return $result;
            }
        } catch (\Throwable $exception) {
            Log::warning('Forward geocoder unavailable.', ['exception' => $exception::class]);
        }

        // Do not cache misses: staff can add detail and retry immediately, and
        // temporary provider failures must not become a 24-hour false miss.
        return $fallback;
    }

    /** @return list<string> */
    private function searchQueries(string $address): array
    {
        $parts = array_values(array_filter(array_map('trim', explode(',', $address))));
        $queries = [$address];

        if (count($parts) >= 4) {
            $queries[] = $parts[0].', '.implode(', ', array_slice($parts, -3));
            $queries[] = $parts[0].', '.$parts[count($parts) - 3];
        }

        if (count($parts) > 1) {
            $queries[] = $parts[0];
        }

        return array_values(array_unique($queries));
    }
}
