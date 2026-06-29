<?php

declare(strict_types=1);

namespace App\Modules\Users\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * T-M12-001 — User lifecycle event.
 *
 * Emitted by `AdminUserService::update()`. The `before` and
 * `after` snapshots are a small set of safe, non-PII columns
 * so the audit log can show what changed without leaking
 * passwords.
 */
class UserUpdated
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $userId,
        public readonly array $before,
        public readonly array $after,
        public readonly array $payload,
    ) {}
}
