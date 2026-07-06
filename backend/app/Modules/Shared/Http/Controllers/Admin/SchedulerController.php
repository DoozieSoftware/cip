<?php

declare(strict_types=1);

namespace App\Modules\Shared\Http\Controllers\Admin;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Shared\Services\SchedulerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M12-012 — Super Admin scheduler dashboard per
 * `docs/09` §23.
 *
 *  - GET  /api/v1/admin/scheduler/jobs
 *  - POST /api/v1/admin/scheduler/jobs/{id}/run-now
 *  - POST /api/v1/admin/scheduler/jobs/{id}/pause
 *  - POST /api/v1/admin/scheduler/jobs/{id}/resume
 *
 * Pause / resume is tracked in a settings row (a list of
 * paused job names). The actual scheduler is consulted via
 * `Schedule::events()` for the list + next-due column.
 */
class SchedulerController extends BaseController
{
    public function __construct(
        private readonly SchedulerService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return $this->respond($this->service->list(), 'Scheduler jobs.');
    }

    public function runNow(Request $request, string $id): JsonResponse
    {
        $this->ensureAdmin($request);
        $result = $this->service->runNow($id);

        return $this->respond(['job' => $id, 'result' => $result], 'Job executed.');
    }

    public function pause(Request $request, string $id): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->service->pause($id);

        return $this->respond(['job' => $id, 'paused' => true], 'Job paused.');
    }

    public function resume(Request $request, string $id): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->service->resume($id);

        return $this->respond(['job' => $id, 'paused' => false], 'Job resumed.');
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'hasRole') || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
