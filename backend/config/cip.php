<?php

declare(strict_types=1);

return [
    'media' => [
        'scanner' => env('CIP_MEDIA_SCANNER', 'clamav'),
        'disk' => env('CIP_MEDIA_DISK', 'local'),
        'quarantine' => [
            // A worker that dies mid-scan may leave RESCANNING behind. The
            // dispatcher can reclaim it after this lease without releasing
            // unverified bytes.
            'rescan_stale_seconds' => (int) env('CIP_MEDIA_RESCAN_STALE_SECONDS', 900),
            'recovery_batch_size' => (int) env('CIP_MEDIA_RECOVERY_BATCH_SIZE', 100),
        ],
    ],
    'notifications' => [
        'sms_driver' => env('CIP_NOTIFICATIONS_SMS_DRIVER', 'log'),
    ],
    'health' => [
        // Queue workers and the scheduler refresh these cache records while
        // alive. Readiness fails after this window, even when the broker is
        // reachable but no process is consuming work.
        'heartbeat_ttl_seconds' => (int) env('CIP_HEALTH_HEARTBEAT_TTL_SECONDS', 180),
        'heartbeat_write_interval_seconds' => (int) env('CIP_HEALTH_HEARTBEAT_WRITE_INTERVAL_SECONDS', 15),
        'required_queues' => env('CIP_HEALTH_REQUIRED_QUEUES', 'media,ai,notifications,default'),
    ],
    'auth' => [
        'otp_expiry_minutes' => env('OTP_TTL_SECONDS', 300) > 0 ? (int) ceil(env('OTP_TTL_SECONDS', 300) / 60) : 5,
        'refresh_ttl_days' => 14,
        'debug_otp' => env('CIP_DEBUG_OTP', false),
    ],
    'ai' => [
        'confidence' => [
            // Reports with AI confidence at or above this value are auto-routed
            // to the recommended department without moderator review.
            // The product specification reserves auto-routing for 95+;
            // lower-confidence recommendations must pass through moderation.
            'auto_route_min' => (int) env('CIP_AI_AUTO_ROUTE_MIN', 95),
            // Reports with confidence >= this value go to moderator
            // review (AI recommends, human decides).
            'moderator_review_min' => (int) env('CIP_AI_MODERATOR_REVIEW_MIN', 80),
        ],
        'risk' => [
            // Security scores do not alter classification confidence, but any
            // signal at or above its threshold must block automatic routing.
            'duplicate_review_min' => (int) env('CIP_AI_DUPLICATE_REVIEW_MIN', 60),
            'misrepresentation_review_min' => (int) env('CIP_AI_MISREPRESENTATION_REVIEW_MIN', 60),
            'synthetic_review_min' => (int) env('CIP_AI_SYNTHETIC_REVIEW_MIN', 50),
            'location_review_min' => (int) env('CIP_AI_LOCATION_REVIEW_MIN', 60),
        ],
        'proof_review' => [
            // MoM rule: only AI proof checks above this confidence can
            // complete a report without an extra manual closure step.
            'auto_close_min' => (int) env('CIP_AI_PROOF_AUTO_CLOSE_MIN', 80),
        ],
    ],
];
