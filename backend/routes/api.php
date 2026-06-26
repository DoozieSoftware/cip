<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Modules\Authentication\Http\Controllers\AuthController;
use App\Modules\Departments\Http\Controllers\Admin\DepartmentController;
use App\Modules\Settings\Http\Controllers\Admin\SettingController;
use App\Providers\RouteServiceProvider;
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

    // Auth (M2) — rate limited per docs/11 §21.
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_OTP)
        ->post('auth/send-otp', [AuthController::class, 'sendOtp'])
        ->name('api.v1.auth.send-otp');
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_CITIZEN)->group(function (): void {
        Route::post('auth/verify-otp', [AuthController::class, 'verifyOtp'])->name('api.v1.auth.verify-otp');
        Route::post('auth/refresh', [AuthController::class, 'refresh'])->name('api.v1.auth.refresh');
    });

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'throttle:'.RouteServiceProvider::LIMITER_CITIZEN])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
    });

    // Super Admin (M3) — gated to super_admin role; rate limited with the admin limiter.
    Route::middleware([
        'auth:sanctum',
        'throttle:'.RouteServiceProvider::LIMITER_ADMIN,
    ])->prefix('admin')->name('api.v1.admin.')->group(function (): void {
        // Departments CRUD (T-M3-016)
        Route::get('departments', [DepartmentController::class, 'index'])->name('departments.index');
        Route::post('departments', [DepartmentController::class, 'store'])->name('departments.store');
        Route::get('departments/{department}', [DepartmentController::class, 'show'])->name('departments.show');
        Route::put('departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
        Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');

        // Settings CRUD (T-M3-017)
        Route::get('settings', [SettingController::class, 'index'])->name('settings.index');
        Route::post('settings', [SettingController::class, 'store'])->name('settings.store');
        Route::get('settings/{setting}', [SettingController::class, 'show'])->name('settings.show');
        Route::put('settings/{setting}', [SettingController::class, 'update'])->name('settings.update');
        Route::delete('settings/{setting}', [SettingController::class, 'destroy'])->name('settings.destroy');
    });
});
