<?php

declare(strict_types=1);

use App\Modules\Notifications\Providers\NotificationsServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\RouteServiceProvider;

return [
    AppServiceProvider::class,
    NotificationsServiceProvider::class,
    RouteServiceProvider::class,
];
