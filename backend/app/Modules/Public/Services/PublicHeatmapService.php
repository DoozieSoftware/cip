<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Grid-bucketed report density for the Public Portal's heat map
 * (Vision §7 / PRD M7). Never returns an individual report's exact
 * coordinates — every point is a `(round(lat, 2), round(lng, 2))`
 * cell (~1.1 km grid). Cells are published only when they contain
 * at least five reports, preventing a single submission from being
 * discoverable through the public map.
 */
class PublicHeatmapService
{
    private const CACHE_KEY = 'public.heatmap';

    private const CACHE_TTL_SECONDS = 300;

    /**
     * @return array<int, array{lat: float, lng: float, count: int}>
     */
    public function grid(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            // A raw query-builder aggregate (not Report::query()) — this
            // is a read-only aggregate projection, not a Report model.
            $rows = DB::table('reports')
                ->join('locations', 'locations.id', '=', 'reports.location_id')
                ->whereNull('reports.deleted_at')
                ->where('reports.created_at', '<=', now()->subHours(24))
                ->select([
                    DB::raw('ROUND(locations.latitude, 2) as lat'),
                    DB::raw('ROUND(locations.longitude, 2) as lng'),
                    DB::raw('COUNT(*) as count'),
                ])
                ->groupBy('lat', 'lng')
                ->havingRaw('COUNT(*) >= 5')
                ->get();

            return $rows->map(function (\stdClass $row): array {
                $lat = $row->lat;
                $lng = $row->lng;
                $count = $row->count;

                return [
                    'lat' => is_numeric($lat) ? (float) $lat : 0.0,
                    'lng' => is_numeric($lng) ? (float) $lng : 0.0,
                    'count' => is_numeric($count) ? (int) $count : 0,
                ];
            })->all();
        });
    }
}
