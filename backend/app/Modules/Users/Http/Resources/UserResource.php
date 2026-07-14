<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Resources;

use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Safe, mobile-friendly representation of a User.
 *
 * Per AGENTS.md ("Never return Models directly") and docs/03 §20
 * (API envelope). Sensitive fields (password, 2FA secret, recovery
 * codes) are NEVER exposed. Role, permission, and safe department
 * membership data are returned only when their relations are
 * eager-loaded; otherwise the keys are omitted. This
 * avoids N+1 queries for the common /me endpoint (where a single
 * user is shown) while keeping the resource safe to use in lists
 * (where roles are not needed).
 *
 * Callers that want staff portal identity must call
 *     $user->load(['roles', 'departments'])
 * before serialisation. The auth controller does this on the
 * verify-otp, refresh, and me paths.
 *
 * @property-read User $resource
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->resource;

        $payload = [
            'id' => $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'email' => $user->email,
            'anonymous_enabled' => (bool) $user->anonymous_enabled,
            'status' => $user->status,
            'otp_verified_at' => $user->otp_verified_at?->toIso8601String(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];

        // Lazy roles + permissions. `relationLoaded('roles')` is true
        // only when the caller has called ->load('roles') or the
        // relation was eager-loaded in a query. In that case we
        // also compute permissions (Spatie Permission derives them
        // from roles->permissions).
        if ($user->relationLoaded('roles')) {
            $payload['roles'] = $user->roles->pluck('name')->values()->all();
            $payload['permissions'] = $user->getAllPermissions()->pluck('name')->values()->all();
        }

        if ($user->relationLoaded('departments')) {
            $payload['departments'] = $user->departments->map(static fn ($department): array => [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
                'is_manager' => (bool) $department->pivot?->is_manager,
            ])->values()->all();
        }

        return $payload;
    }
}
