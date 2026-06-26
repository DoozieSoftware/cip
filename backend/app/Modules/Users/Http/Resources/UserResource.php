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
 * codes) are NEVER exposed. The `roles` and `permissions` arrays
 * come from Spatie Permission and are added to support role-aware
 * clients (PWA, portals).
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

        return [
            'id' => $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'email' => $user->email,
            'anonymous_enabled' => (bool) $user->anonymous_enabled,
            'status' => $user->status,
            'otp_verified_at' => $user->otp_verified_at?->toIso8601String(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'roles' => $user->roles->pluck('name'),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
