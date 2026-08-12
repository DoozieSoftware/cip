<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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
                $response = Http::timeout(5)->connectTimeout(2)->withHeaders([
                    'Accept' => 'application/json', 'User-Agent' => 'CIP-ReverseGeocoder/1.0 (privacy-proxy)',
                ])->get($baseUrl, ['lat' => $latitude, 'lon' => $longitude, 'format' => 'jsonv2', 'zoom' => 18]);

                if (! $response->successful()) {
                    return ['label' => '', 'geocoded' => false];
                }
                $display = $response->json('display_name');

                return is_string($display) && trim($display) !== ''
                    ? ['label' => trim($display), 'geocoded' => true]
                    : ['label' => '', 'geocoded' => false];
            } catch (\Throwable) {
                return ['label' => '', 'geocoded' => false];
            }
        });
    }
}
