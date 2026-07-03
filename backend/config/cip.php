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
    'auth' => [
        'otp_expiry_minutes' => env('OTP_TTL_SECONDS', 300) > 0 ? (int) ceil(env('OTP_TTL_SECONDS', 300) / 60) : 5,
        'refresh_ttl_days' => 14,
        'debug_otp' => env('CIP_DEBUG_OTP', false),
    ],
];
