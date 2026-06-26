<?php

declare(strict_types=1);

use App\Http\Controllers\ApiDocumentationController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'name' => 'Civic Intelligence Platform',
    'status' => 'ok',
    'docs' => url('/api/documentation'),
]));

Route::get('/api/documentation', [ApiDocumentationController::class, 'show'])->name('api.docs');
