<?php

declare(strict_types=1);

return [
    'media' => [
        'scanner' => env('CIP_MEDIA_SCANNER', 'clamav'),
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
    'ai' => [
        'confidence' => [
            // Reports with AI confidence > this value are auto-routed
            // to the recommended department without moderator review.
            // The vision provider caps at 0.95 and quality calibration
            // can reduce it further, so 90 catches the realistic range.
            'auto_route_min' => (int) env('CIP_AI_AUTO_ROUTE_MIN', 90),
            // Reports with confidence >= this value go to moderator
            // review (AI recommends, human decides).
            'moderator_review_min' => (int) env('CIP_AI_MODERATOR_REVIEW_MIN', 75),
        ],
    ],
];
