<?php

declare(strict_types=1);

namespace App\Modules\Users\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Platform user model.
 *
 * - UUID primary key (HasUuids)
 * - Soft deletes
 * - Sanctum personal access tokens
 * - Spatie Permission (HasRoles)
 * - Notifiable (channels land in M9)
 *
 * Citizens authenticate via OTP only; staff (moderator / department /
 * admin) have a password. `mobile` is the canonical identifier for
 * citizens; `email` is the canonical identifier for staff.
 *
 * Module relations (refreshTokens, loginHistories, securityEvents,
 * otps, auditLogs) are added by the tasks that own the related models:
 * - T-M2-006/007 refresh tokens
 * - T-M2-008 login histories
 * - T-M2-009/021 security events
 * - T-M2-005 otps
 * - T-M2-020 audit logs
 */
class User extends Authenticatable
{
    use HasApiTokens;

    /**
     * @use HasFactory<UserFactory>
     */
    use HasFactory;
    use HasRoles;
    use HasUuids;
    use Notifiable;
    use SoftDeletes;

    protected $table = 'users';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'mobile',
        'email',
        'password',
        'anonymous_enabled',
        'status',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'otp_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'anonymous_enabled' => 'boolean',
            'password' => 'hashed',
        ];
    }

    /**
     * Citizen default guard: only allowed when status is 'active'.
     */
    public function isActive(): bool
    {
        return $this->status === 'active' && $this->deleted_at === null;
    }

    /**
     * Marks a successful login. Called by the auth services and the
     * refresh endpoint when the principal is re-validated.
     */
    public function recordLogin(string $ip): void
    {
        $this->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ])->save();
    }
}
