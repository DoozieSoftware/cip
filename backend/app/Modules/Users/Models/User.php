<?php

declare(strict_types=1);

namespace App\Modules\Users\Models;

use App\Modules\Authentication\Models\LoginHistory;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Security\Models\SecurityEvent;
use Carbon\CarbonInterface;
use Database\Factories\Modules\Users\Models\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
 * - T-M2-006/007 refresh tokens (relation added in T-M2-007)
 * - T-M2-008 login histories
 * - T-M2-009/021 security events
 * - T-M2-005 otps
 * - T-M2-020 audit logs
 *
 * @property string $id
 * @property string|null $name
 * @property string $mobile
 * @property string|null $email
 * @property string|null $password
 * @property CarbonInterface|null $otp_verified_at
 * @property CarbonInterface|null $last_login_at
 * @property string|null $last_login_ip
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property CarbonInterface|null $two_factor_confirmed_at
 * @property string $status
 * @property bool $anonymous_enabled
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
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
     * Refresh tokens issued for this user (per docs/11 §7).
     *
     * @return HasMany<RefreshToken, $this>
     */
    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class, 'user_id');
    }

    /**
     * Login history for this user (per docs/11 §6, §28).
     *
     * @return HasMany<LoginHistory, $this>
     */
    public function loginHistories(): HasMany
    {
        return $this->hasMany(LoginHistory::class, 'user_id');
    }

    /**
     * Security events for this user (per docs/11 §29).
     *
     * @return HasMany<SecurityEvent, $this>
     */
    public function securityEvents(): HasMany
    {
        return $this->hasMany(SecurityEvent::class, 'user_id');
    }

    /**
     * Citizen default guard: only allowed when status is 'active'.
     */
    public function isActive(): bool
    {
        return $this->status === 'active' && $this->deleted_at === null;
    }

    /**
     * M11 — M:N relation to the departments this user is a member of.
     * Backed by the `department_users` pivot populated by the M3 seeders.
     *
     * @return BelongsToMany<Department, $this>
     */
    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Modules\Departments\Models\Department::class,
            'department_users',
            'user_id',
            'department_id',
        )->using(\App\Modules\Users\DepartmentUserPivot::class)
          ->withPivot(['id', 'is_manager', 'assigned_at'])
          ->withTimestamps();
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
