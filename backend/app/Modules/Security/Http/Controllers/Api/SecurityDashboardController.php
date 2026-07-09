<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Security\Services\SecurityDashboardService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M11-020 — Security dashboard endpoint.
 *
 * Per `docs/08` §19. The dashboard is a read-only JSON snapshot
 * intended for the operations portal's Security page. Authorisation
 * is the same as the audit log: `super_admin`, `system`, `auditor`,
 * `department_admin`.
 */
class SecurityDashboardController extends Controller
{
    public function __construct(private readonly SecurityDashboardService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new ApiException('UNAUTHENTICATED', 'Authentication required.', 401);
        }
        // A role from the fixed list, OR the `security.view` Spatie
        // permission — the latter is what the Super Admin's Roles &
        // Permissions screen actually edits, so it needs a real effect here.
        $hasPermission = false;
        try {
            $hasPermission = $user->hasPermissionTo('security.view');
        } catch (\Throwable) {
            // Permission not seeded/registered — fall through to the role check.
        }
        if (! $user->hasAnyRole(['super_admin', 'system', 'auditor', 'department_admin']) && ! $hasPermission) {
            throw new ApiException('FORBIDDEN', 'Security dashboard is read-only for auditors and admins.', 403);
        }

        $snapshot = $this->service->snapshot();

        return response()->json([
            'success' => true,
            'data' => $snapshot,
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
