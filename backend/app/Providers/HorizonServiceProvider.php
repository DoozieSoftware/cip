<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        parent::boot();

        Horizon::night();
    }

    /**
     * Register the Horizon gate.
     *
     * Horizon is restricted to the local environment until M2 lands the
     * dedicated authorization rules. In non-local environments, only
     * super-admin users (or those with a cip.local email) can access it.
     *
     * @param  \Illuminate\Contracts\Auth\Authenticatable|null  $user
     */
    protected function gate(?Authenticatable $user = null): void
    {
        if (app()->environment('local')) {
            return;
        }

        Gate::define('viewHorizon', static function ($user = null): bool {
            /** @var \Illuminate\Contracts\Auth\Authenticatable|null $auth */
            $auth = $user;
            $email = is_object($auth) ? $auth->email ?? null : null;
            return is_string($email) && str_ends_with($email, '@cip.local');
        });
    }
}
