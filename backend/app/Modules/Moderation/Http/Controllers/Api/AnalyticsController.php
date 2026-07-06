<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Controllers\Api;

use App\Modules\Moderation\Services\ModerationAnalyticsService;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends BaseController
{
    public function __construct(
        private readonly ModerationAnalyticsService $analytics,
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAnalytics', Report::class);

        return $this->respond($this->analytics->summary());
    }

    public function aiPerformance(Request $request): JsonResponse
    {
        $this->authorize('viewAnalytics', Report::class);

        return $this->respond(
            $this->analytics->aiPerformance((string) $request->query('window', '7d')),
        );
    }
}
