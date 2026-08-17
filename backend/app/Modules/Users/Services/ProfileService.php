<?php

declare(strict_types=1);

namespace App\Modules\Users\Services;

use App\Modules\Users\Models\User;

/** Applies authenticated, non-identity profile preferences. */
class ProfileService
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(User $user, array $attributes): User
    {
        if (array_key_exists('name', $attributes) && is_string($attributes['name'])) {
            $attributes['name'] = trim($attributes['name']) ?: null;
        }

        if (array_key_exists('preferred_name', $attributes) && is_string($attributes['preferred_name'])) {
            $attributes['preferred_name'] = trim($attributes['preferred_name']) ?: null;
        }

        if (array_key_exists('email', $attributes) && is_string($attributes['email'])) {
            $attributes['email'] = trim($attributes['email']) ?: null;
        }

        $user->fill($attributes);
        $user->save();

        return $user->refresh();
    }
}
