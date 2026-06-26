<?php

declare(strict_types=1);

return [
    'media' => [
        'scanner' => env('CIP_MEDIA_SCANNER', 'log'),
    ],
    'notifications' => [
        'sms_driver' => env('CIP_NOTIFICATIONS_SMS_DRIVER', 'log'),
    ],
];
