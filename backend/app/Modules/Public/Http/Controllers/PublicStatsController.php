<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Controllers;

use App\Modules\Public\Services\PublicStatsService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/v1/public/stats` — unauthenticated platform statistics
 * for the landing page and (from M17) the Public Transparency
 * Portal. Rate-limited (`public` limiter) and cached server-side for
 * 5 minutes by `PublicStatsService`; no per-request DB load beyond
 * a cache read once warm.
 */
class PublicStatsController extends BaseController
{
    public function __construct(private readonly PublicStatsService $stats) {}

    public function index(): JsonResponse
    {
        return $this->respond($this->stats->summary());
    }
}
