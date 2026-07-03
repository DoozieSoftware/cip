<?php

declare(strict_types=1);

/*
 * Notifications configuration.
 *
 * Each block is read by the matching channel implementation:
 *  - fcm               : FCM HTTP v1 endpoint + bearer (PushChannel)
 *  - webhooks          : map of notification.type -> inbound URL
 *                        (WebhookChannel)
 *  - webhook_secret    : HMAC-SHA256 secret used to sign
 *                        outbound webhook bodies
 */
return [
    'fcm' => [
        'endpoint' => env('FCM_ENDPOINT'),
        'project_id' => env('FCM_PROJECT_ID'),
        'access_token' => env('FCM_ACCESS_TOKEN'),
    ],

    'webhooks' => [
        // 'report.assigned' => env('WEBHOOK_REPORT_ASSIGNED', ''),
        // 'report.status_changed' => env('WEBHOOK_REPORT_STATUS', ''),
    ],

    'webhook_secret' => env('WEBHOOK_SECRET'),
];
