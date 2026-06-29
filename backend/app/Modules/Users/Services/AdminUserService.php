<?php

declare(strict_types=1);

namespace App\Modules\Users\Services;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Events\UserCreated;
use App\Modules\Users\Events\UserDeleted;
use App\Modules\Users\Events\UserUpdated;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * T-M12-001 — Super Admin user CRUD.
 *
 * Per `docs/09` §8. All writes go through this service so that
 * (a) passwords are always hashed, (b) status transitions
 * are uniform, (c) the lifecycle events fire once and the
 * audit pipeline picks them up.
 */
class AdminUserService extends BaseService
{
    public const ALLOWED_STATUSES = ['active', 'suspended', 'banned', 'pending'];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(array $payload): User
    {
        $this->assertValidPayload($payload);

        return $this->transaction(function () use ($payload): User {
            $user = new User;
            $user->fill($this->withoutPassword($payload));
            if (! empty($payload['password'])) {
                $user->password = Hash::make($payload['password']);
            }
            $user->status = $payload['status'] ?? 'active';
            $user->save();

            if (! empty($payload['roles']) && is_array($payload['roles'])) {
                $this->syncRolesByName($user, $payload['roles']);
            }

            event(new UserCreated($user->id, $payload));

            return $user->fresh(['roles']);
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function update(User $user, array $payload): User
    {
        $this->assertValidPayload($payload, partial: true);

        return $this->transaction(function () use ($user, $payload): User {
            $before = $user->only(['name', 'email', 'mobile', 'status', 'anonymous_enabled']);
            $user->fill($this->withoutPassword($payload));
            if (! empty($payload['password'])) {
                $user->password = Hash::make($payload['password']);
            }
            if (array_key_exists('status', $payload)) {
                $user->status = $payload['status'];
            }
            $user->save();

            if (! empty($payload['roles']) && is_array($payload['roles'])) {
                $this->syncRolesByName($user, $payload['roles']);
            }

            $after = $user->only(['name', 'email', 'mobile', 'status', 'anonymous_enabled']);
            event(new UserUpdated($user->id, $before, $after, $payload));

            return $user->fresh(['roles']);
        });
    }

    public function delete(User $user): void
    {
        $this->transaction(function () use ($user): void {
            $id = $user->id;
            $user->delete();
            event(new UserDeleted($id));
        });
    }

    public function restore(User $user): User
    {
        return $this->transaction(function () use ($user): User {
            $user->restore();

            return $user->fresh(['roles']);
        });
    }

    /**
     * @param  array<string>  $roleNames
     */
    private function syncRolesByName(User $user, array $roleNames): void
    {
        $existing = Role::query()
            ->whereIn('name', $roleNames)
            ->pluck('name')
            ->all();
        $missing = array_values(array_diff($roleNames, $existing));
        if ($missing !== []) {
            throw new ApiException(
                'UNKNOWN_ROLES',
                'One or more role names do not exist: ' . implode(', ', $missing),
                422,
                ['missing' => $missing],
            );
        }
        $user->syncRoles($existing);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function withoutPassword(array $payload): array
    {
        unset($payload['password']);

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function assertValidPayload(array $payload, bool $partial = false): void
    {
        if (! $partial || array_key_exists('status', $payload)) {
            $status = $payload['status'] ?? null;
            if ($status !== null && ! in_array($status, self::ALLOWED_STATUSES, true)) {
                throw new ApiException(
                    'INVALID_STATUS',
                    'Status must be one of: ' . implode(', ', self::ALLOWED_STATUSES),
                    422,
                    ['allowed' => self::ALLOWED_STATUSES],
                );
            }
        }
    }
}
