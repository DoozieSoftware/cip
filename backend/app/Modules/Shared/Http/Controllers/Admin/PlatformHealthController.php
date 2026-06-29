<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Services\PlatformHealthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-015 — Super Admin platform-health dashboard per
 * `docs/09` §22.
 *
 *  - GET /api/v1/admin/health
 *
 * Aggregates the status of:
 *  - database
 *  - redis
 *  - queue
 *  - ai (active provider count)
 *  - storage (probed disk)
 *  - scheduler (event count)
 *
 * Returns 200 even when a component is `down` — the
 * response payload is the source of truth.
 */
class PlatformHealthController extends BaseController
{
    public function __construct(
        private readonly PlatformHealthService $service,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $summary = $this->service->summary();

        return $this->respond($summary, 'Platform health summary.');
    }

    public function components(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return $this->respond(
            ['components' => $this->service->snapshot(), 'checked_at' => now()->toIso8601String()],
            'Platform health components.',
        );
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
