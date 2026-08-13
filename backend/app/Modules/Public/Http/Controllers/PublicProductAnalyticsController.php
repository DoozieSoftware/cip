<?php

declare(strict_types=1);

namespace App\Modules\Public\Http\Controllers;

use App\Modules\Public\Http\Requests\RecordProductAnalyticsEventRequest;
use App\Modules\Public\Services\ProductAnalyticsService;
use App\Modules\Shared\Http\Controllers\BaseController;
use Illuminate\Http\JsonResponse;

class PublicProductAnalyticsController extends BaseController
{
    public function __construct(private readonly ProductAnalyticsService $analytics) {}

    public function store(RecordProductAnalyticsEventRequest $request): JsonResponse
    {
        /** @var array{event_code: string, properties?: array<string, mixed>} $payload */
        $payload = $request->validated();
        $this->analytics->record($payload['event_code'], $payload['properties'] ?? []);

        return $this->respond(['accepted' => true], status: 202);
    }
}
