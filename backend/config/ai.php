<?php

declare(strict_types=1);

return [
    'gemini' => [
        'base_url' => env('AI_GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
        'model' => env('AI_GEMINI_MODEL', 'gemini-3.6-flash'),
        'key' => env('AI_GEMINI_KEY'),
    ],

    'modal' => [
        'base_url' => env('AI_MODAL_BASE_URL', 'https://akshayjoshi999--cip-vision-v3-serve.modal.run'),
        'model' => env('AI_MODAL_MODEL', 'Qwen/Qwen2.5-VL-7B-Instruct'),
        'key' => env('AI_MODAL_KEY'),
        'secret' => env('AI_MODAL_SECRET'),
    ],
];
