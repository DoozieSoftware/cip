<?php

declare(strict_types=1);

namespace App\Modules\Users\Events;

use App\Modules\Users\Services\RoleService;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted when a permission is granted to or revoked from a user
 * via {@see RoleService}. The audit
 * middleware (T-M2-020) listens for this event to record a row in
 * the `audit_logs` table.
 */
class UserPermissionChanged
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $userId,
        public readonly string $permission,
        public readonly string $action,
    ) {}
}
