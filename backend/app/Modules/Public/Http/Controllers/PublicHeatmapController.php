<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Controllers;

use App\Modules\Public\Services\PublicHeatmapService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/v1/public/heatmap` — unauthenticated, grid-bucketed
 * report density (never exact coordinates). Rate-limited (`public`
 * limiter) and cached 5 minutes by `PublicHeatmapService`.
 */
class PublicHeatmapController extends BaseController
{
    public function __construct(private readonly PublicHeatmapService $heatmap) {}

    public function index(): JsonResponse
    {
        return $this->respond([
            'points' => $this->heatmap->grid(),
            'privacy' => [
                'minimum_group_size' => 5,
                'cell_precision_decimals' => 2,
                'delayed_publication_hours' => 24,
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}
