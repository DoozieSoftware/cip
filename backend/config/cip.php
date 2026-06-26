<?php

declare(strict_types=1);

return [
    'media' => [
        'scanner' => env('CIP_MEDIA_SCANNER', 'log'),
        'disk' => env('CIP_MEDIA_DISK', 'local'),
    ],
    'notifications' => [
        'sms_driver' => env('CIP_NOTIFICATIONS_SMS_DRIVER', 'log'),
    ],
];
