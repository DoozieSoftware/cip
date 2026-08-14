<?php

declare(strict_types=1);

return [
    'vertex' => [
        'project_id' => env('GOOGLE_CLOUD_PROJECT', env('GCLOUD_PROJECT', '')),
        'location' => env('AI_VERTEX_LOCATION', 'global'),
        'model' => env('AI_VERTEX_MODEL', 'google/gemini-3.7-flash'),
        'credentials_path' => env('GOOGLE_APPLICATION_CREDENTIALS'),
    ],

    'modal' => [
        'base_url' => env('AI_MODAL_BASE_URL', 'https://akshayjoshi999--cip-vision-v3-serve.modal.run'),
        'model' => env('AI_MODAL_MODEL', 'Qwen/Qwen2.5-VL-7B-Instruct'),
        'key' => env('AI_MODAL_KEY'),
        'secret' => env('AI_MODAL_SECRET'),
    ],
];
