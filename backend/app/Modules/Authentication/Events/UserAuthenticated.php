<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Events;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted after a successful authentication (citizen OTP verify,
 * staff login, refresh-token rotation).
 *
 * Per docs/03 §16 (Event Architecture) and §19 (Audit Logging):
 * downstream listeners may record a `security_events` row, kick off
 * a notification, or warm a cache. The event is intentionally thin
 * — listeners must not mutate state on the User.
 */
class UserAuthenticated
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $context  Free-form metadata (ip, user_agent, channel)
     */
    public function __construct(
        public readonly User $user,
        public readonly string $channel = 'otp',
        public readonly array $context = [],
    ) {}
}
