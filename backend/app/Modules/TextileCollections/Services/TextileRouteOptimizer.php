<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

/**
 * Nearest-neighbour visit ordering for trip manifests.
 *
 * Pure and deterministic (haversine distance, no external calls) so the
 * driver run reads 1 → 2 → 3 → 4 by proximity instead of booking order.
 * Requests without coordinates cannot be chained — they keep their
 * relative input order at the end of the run.
 */
final class TextileRouteOptimizer
{
    /**
     * @param  list<array{id: string, latitude: float|null, longitude: float|null}>  $stops
     * @return list<string> Ordered request ids, nearest-first.
     */
    public static function optimize(array $stops, ?float $startLatitude, ?float $startLongitude): array
    {
        $mapped = [];
        $unmapped = [];

        foreach ($stops as $stop) {
            if (is_numeric($stop['latitude'] ?? null) && is_numeric($stop['longitude'] ?? null)) {
                $mapped[] = [
                    'id' => (string) $stop['id'],
                    'latitude' => (float) $stop['latitude'],
                    'longitude' => (float) $stop['longitude'],
                ];
            } else {
                $unmapped[] = (string) $stop['id'];
            }
        }

        $ordered = [];

        if ($mapped !== []) {
            $anchorLat = $startLatitude;
            $anchorLng = $startLongitude;

            if ($anchorLat === null || $anchorLng === null) {
                $anchorLat = $mapped[0]['latitude'];
                $anchorLng = $mapped[0]['longitude'];
            }

            $remaining = $mapped;

            while ($remaining !== []) {
                $bestIdx = 0;
                $bestDist = self::haversineKm($anchorLat, $anchorLng, $remaining[0]['latitude'], $remaining[0]['longitude']);

                foreach ($remaining as $idx => $candidate) {
                    $dist = self::haversineKm($anchorLat, $anchorLng, $candidate['latitude'], $candidate['longitude']);

                    if ($dist < $bestDist) {
                        $bestDist = $dist;
                        $bestIdx = $idx;
                    }
                }

                $chosen = $remaining[$bestIdx];
                array_splice($remaining, $bestIdx, 1);
                $ordered[] = $chosen['id'];
                $anchorLat = $chosen['latitude'];
                $anchorLng = $chosen['longitude'];
            }
        }

        return array_merge($ordered, $unmapped);
    }

    public static function haversineKm(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $earthKm = 6371.0;
        $dLat = deg2rad($latB - $latA);
        $dLng = deg2rad($lngB - $lngA);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($latA)) * cos(deg2rad($latB)) * sin($dLng / 2) ** 2;

        return 2 * $earthKm * asin(min(1.0, sqrt($a)));
    }
}
