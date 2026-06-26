<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Modules\Authentication\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', [HealthController::class, 'live'])->name('api.v1.health.live');
    Route::get('health/ready', [HealthController::class, 'ready'])->name('api.v1.health.ready');
    Route::get('openapi.yaml', function () {
        $path = storage_path('api-docs/openapi.yaml');

        if (! file_exists($path)) {
            abort(404);
        }

        return response()->file($path, ['Content-Type' => 'application/yaml']);
    })->name('api.v1.openapi');

    // Auth (M2)
    Route::post('auth/send-otp', [AuthController::class, 'sendOtp'])->name('api.v1.auth.send-otp');
    Route::post('auth/verify-otp', [AuthController::class, 'verifyOtp'])->name('api.v1.auth.verify-otp');
    Route::post('auth/refresh', [AuthController::class, 'refresh'])->name('api.v1.auth.refresh');

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
    });
});
