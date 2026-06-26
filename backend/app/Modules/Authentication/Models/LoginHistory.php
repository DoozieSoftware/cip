<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Login history record.
 *
 * One row per authentication attempt. Persisted by the auth flow
 * (T-M2-014 verify-otp) and the logout flow (T-M2-016). Used by the
 * moderator / super-admin portals to render "last login..." and the
 * security-event stream (docs/11 §28).
 *
 * @property string $id
 * @property string|null $user_id
 * @property string $mobile
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $device_fingerprint
 * @property bool $success
 * @property string|null $failure_reason
 * @property Carbon $login_at
 */
class LoginHistory extends Model
{
    use HasUuids;

    protected $table = 'login_histories';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'mobile',
        'ip',
        'user_agent',
        'device_fingerprint',
        'success',
        'failure_reason',
        'login_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'login_at' => 'datetime',
        ];
    }

    /**
     * Owner of the attempt. Nullable because a failure may target a
     * mobile that has not yet been registered (citizens authenticate
     * by mobile first, user is upserted on success).
     *
     * @return BelongsTo<User, LoginHistory>
     */
    public function user(): BelongsTo
    {
        /** @var BelongsTo<User, LoginHistory> $relation */
        $relation = $this->belongsTo(User::class, 'user_id');

        return $relation;
    }
}
