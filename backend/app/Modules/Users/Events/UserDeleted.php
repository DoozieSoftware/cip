<?php

declare(strict_types=1);

namespace App\Modules\Users\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * T-M12-001 — User lifecycle event.
 *
 * Emitted by `AdminUserService::delete()`. The `audit_logs`
 * row written from this event uses the soft-delete marker
 * (`deleted_at`) so the diff is reconstructable.
 */
class UserDeleted
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public readonly string $userId) {}
}
