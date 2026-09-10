<?php

declare(strict_types=1);

return [

    'geocoder' => [
        'url' => env('GEOCODER_URL', 'https://nominatim.openstreetmap.org/reverse'),
        'search_url' => env('GEOCODER_SEARCH_URL', 'https://nominatim.openstreetmap.org/search'),
        // Bias forward searches to India so generic street names (e.g.
        // "Station Road") resolve locally instead of abroad (#26).
        'search_countrycodes' => env('GEOCODER_SEARCH_COUNTRIES', 'in'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
