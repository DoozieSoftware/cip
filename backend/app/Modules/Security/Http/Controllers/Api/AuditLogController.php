<?php

declare(strict_types=1);

namespace App\Modules\Security\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * T-M11-019 — Audit log search.
 *
 * Per `docs/08` §18. The endpoint is gated to
 * `super_admin` + `auditor` roles (the platform's
 * read-only auditor surface) and exposes a paginated
 * list of `audit_logs` rows with filters:
 *
 *  - user_id, role, action, entity, entity_id
 *  - ip, device_fingerprint (Browser)
 *  - date_from, date_to (on `created_at`)
 *  - search (action LIKE, entity LIKE)
 *
 * The audit log is immutable — the controller never
 * exposes a write method. Pagination is capped at
 * 500 per page (matching the M11 list convention).
 */
class AuditLogController extends Controller
{
    public const MAX_PER_PAGE = 500;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new ApiException('UNAUTHENTICATED', 'Authentication required.', 401);
        }
        if (! $user->hasAnyRole(['super_admin', 'system', 'auditor', 'department_admin'])) {
            throw new ApiException('FORBIDDEN', 'Audit log is read-only for auditors and admins.', 403);
        }

        $query = AuditLog::query()->orderByDesc('created_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', (string) $request->string('user_id'));
        }
        if ($request->filled('action')) {
            $query->where('action', 'like', '%' . (string) $request->string('action') . '%');
        }
        if ($request->filled('entity')) {
            $query->where('entity', (string) $request->string('entity'));
        }
        if ($request->filled('entity_id')) {
            $query->where('entity_id', (string) $request->string('entity_id'));
        }
        if ($request->filled('ip')) {
            $query->where('ip', (string) $request->string('ip'));
        }
        if ($request->filled('device_fingerprint')) {
            $query->where('device_fingerprint', 'like', '%' . (string) $request->string('device_fingerprint') . '%');
        }
        if ($request->filled('role')) {
            $roleName = (string) $request->string('role');
            $query->whereHas('user', function ($q) use ($roleName): void {
                $q->whereHas('roles', function ($r) use ($roleName): void {
                    $r->where('name', $roleName);
                });
            });
        }
        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', (string) $request->string('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', (string) $request->string('date_to'));
        }
        if ($request->filled('search')) {
            $term = '%' . (string) $request->string('search') . '%';
            $query->where(function ($q) use ($term): void {
                $q->where('action', 'like', $term)
                    ->orWhere('entity', 'like', $term)
                    ->orWhere('entity_id', 'like', $term);
            });
        }

        $perPage = (int) $request->query('per_page', 25);
        $perPage = max(1, min(self::MAX_PER_PAGE, $perPage));

        $page = $query->paginate($perPage);

        $rows = collect($page->items())->map(static function (AuditLog $row): array {
            $user = $row->user;
            $roles = $user?->roles?->pluck('name')->all() ?? [];
            return [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'user_name' => $user?->name,
                'roles' => $roles,
                'entity' => $row->entity,
                'entity_id' => $row->entity_id,
                'action' => $row->action,
                'before' => $row->before,
                'after' => $row->after,
                'ip' => $row->ip,
                'device_fingerprint' => $row->device_fingerprint,
                'request_id' => $row->request_id,
                'created_at' => $row->created_at?->toIso8601String(),
            ];
        })->all();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
            'trace_id' => $request->attributes->get('trace_id'),
        ]);
    }
}
