<?php

declare(strict_types=1);

use App\Modules\Media\Providers\MediaServiceProvider;
use App\Modules\Notifications\Providers\NotificationsServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\RouteServiceProvider;

return [
    AppServiceProvider::class,
    MediaServiceProvider::class,
    NotificationsServiceProvider::class,
    RouteServiceProvider::class,
];
