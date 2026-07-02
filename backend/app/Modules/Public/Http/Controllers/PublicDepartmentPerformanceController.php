<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Controllers;

use App\Modules\Public\Services\PublicDepartmentPerformanceService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/v1/public/departments/performance` — unauthenticated
 * resolution-rate and median-resolution-time per department. Only
 * `name`/`code`/aggregate counts — no internal notes, no officer
 * names. Rate-limited (`public` limiter) and cached 5 minutes.
 */
class PublicDepartmentPerformanceController extends BaseController
{
    public function __construct(private readonly PublicDepartmentPerformanceService $performance) {}

    public function index(): JsonResponse
    {
        return $this->respond(['departments' => $this->performance->summary()]);
    }
}
