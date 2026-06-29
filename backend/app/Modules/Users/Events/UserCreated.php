<?php

declare(strict_types=1);

namespace App\Modules\Users\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * T-M12-001 — User lifecycle event.
 *
 * Emitted by `AdminUserService::create()`. The audit pipeline
 * listens to it and writes a `users.created` row to
 * `audit_logs`.
 */
class UserCreated
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $userId,
        public readonly array $payload,
    ) {}
}
