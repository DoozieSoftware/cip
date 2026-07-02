<?php

declare(strict_types=1);

use App\Modules\AI\Providers\AiServiceProvider;
use App\Modules\Departments\Providers\DepartmentServiceProvider;
use App\Modules\Media\Providers\MediaServiceProvider;
use App\Modules\Moderation\Providers\ModerationServiceProvider;
use App\Modules\Notifications\Providers\NotificationsServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\RouteServiceProvider;

return [
    AppServiceProvider::class,
    AiServiceProvider::class,
    DepartmentServiceProvider::class,
    MediaServiceProvider::class,
    ModerationServiceProvider::class,
    NotificationsServiceProvider::class,
    RouteServiceProvider::class,
];
