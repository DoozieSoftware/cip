<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Modules\Authentication\Http\Controllers\AuthController;
use App\Modules\Departments\Http\Controllers\Admin\DepartmentController;
use App\Modules\Media\Http\Controllers\Api\MediaController;
use App\Modules\AI\Http\Controllers\Admin\AiProviderAdminController;
use App\Modules\AI\Http\Controllers\Admin\AiPromptAdminController;
use App\Modules\AI\Http\Controllers\Internal\InternalAiController;
use App\Modules\Reports\Http\Controllers\Api\ReportsController;
use App\Modules\Settings\Http\Controllers\Admin\AppConfigController;
use App\Modules\Settings\Http\Controllers\Admin\SettingController;
use App\Modules\Workflow\Http\Controllers\Admin\WorkflowAdminController;
use App\Modules\Routing\Http\Controllers\Admin\RoutingAdminController;
use App\Modules\Routing\Http\Controllers\Admin\ReassignController;
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

        // Feature flag CRUD (T-M3-018)
        Route::get('app-configs', [AppConfigController::class, 'index'])->name('app-configs.index');
        Route::post('app-configs', [AppConfigController::class, 'store'])->name('app-configs.store');
        Route::get('app-configs/{app_config}/evaluate', [AppConfigController::class, 'evaluate'])->name('app-configs.evaluate');
        Route::get('app-configs/{app_config}', [AppConfigController::class, 'show'])->name('app-configs.show');
        Route::put('app-configs/{app_config}', [AppConfigController::class, 'update'])->name('app-configs.update');
        Route::delete('app-configs/{app_config}', [AppConfigController::class, 'destroy'])->name('app-configs.destroy');

        // Workflow definitions CRUD (T-M6-013)
        Route::get('workflows', [WorkflowAdminController::class, 'index'])->name('workflows.index');
        Route::post('workflows', [WorkflowAdminController::class, 'store'])->name('workflows.store');
        Route::get('workflows/{workflow}', [WorkflowAdminController::class, 'show'])->name('workflows.show');
        Route::put('workflows/{workflow}', [WorkflowAdminController::class, 'update'])->name('workflows.update');
        Route::delete('workflows/{workflow}', [WorkflowAdminController::class, 'destroy'])->name('workflows.destroy');

        // Routing rules CRUD (T-M7-009)
        Route::get('routing-rules', [RoutingAdminController::class, 'index'])->name('routing-rules.index');
        Route::post('routing-rules', [RoutingAdminController::class, 'store'])->name('routing-rules.store');
        Route::post('routing-rules/reorder', [RoutingAdminController::class, 'reorder'])->name('routing-rules.reorder');
        Route::get('routing-rules/{rule}', [RoutingAdminController::class, 'show'])->name('routing-rules.show');
        Route::put('routing-rules/{rule}', [RoutingAdminController::class, 'update'])->name('routing-rules.update');
        Route::delete('routing-rules/{rule}', [RoutingAdminController::class, 'destroy'])->name('routing-rules.destroy');

        // Manual reassignment (T-M7-010)
        Route::post('reports/{report}/reassign', ReassignController::class)->name('reports.reassign');

        // AI provider configs CRUD (T-M8-024)
        Route::get('ai/providers', [AiProviderAdminController::class, 'index'])->name('ai.providers.index');
        Route::post('ai/providers', [AiProviderAdminController::class, 'store'])->name('ai.providers.store');
        Route::get('ai/providers/{provider}', [AiProviderAdminController::class, 'show'])->name('ai.providers.show');
        Route::put('ai/providers/{provider}', [AiProviderAdminController::class, 'update'])->name('ai.providers.update');
        Route::delete('ai/providers/{provider}', [AiProviderAdminController::class, 'destroy'])->name('ai.providers.destroy');

        // AI prompt versions CRUD + approve/rollback (T-M8-025)
        Route::get('ai/prompts', [AiPromptAdminController::class, 'index'])->name('ai.prompts.index');
        Route::post('ai/prompts', [AiPromptAdminController::class, 'store'])->name('ai.prompts.store');
        Route::get('ai/prompts/{prompt}', [AiPromptAdminController::class, 'show'])->name('ai.prompts.show');
        Route::put('ai/prompts/{prompt}', [AiPromptAdminController::class, 'update'])->name('ai.prompts.update');
        Route::delete('ai/prompts/{prompt}', [AiPromptAdminController::class, 'destroy'])->name('ai.prompts.destroy');
        Route::post('ai/prompts/{prompt}/approve', [AiPromptAdminController::class, 'approve'])->name('ai.prompts.approve');
        Route::post('ai/prompts/{prompt}/rollback', [AiPromptAdminController::class, 'rollback'])->name('ai.prompts.rollback');
    });

    // Internal AI pipeline endpoints (T-M8-021..T-M8-023) — system role only.
    // The system role is held by the platform's shared system user; in
    // production these endpoints are reachable only via internal mTLS
    // from the AI worker. In dev/test we expose them under
    // auth:sanctum + an explicit role check in the controller.
    Route::middleware([
        'auth:sanctum',
        'throttle:'.RouteServiceProvider::LIMITER_ADMIN,
    ])->prefix('internal/ai')->name('api.v1.internal.ai.')->group(function (): void {
        Route::post('process/{reportId}', [InternalAiController::class, 'process'])->name('process');
        Route::get('job/{id}', [InternalAiController::class, 'job'])->name('job');
        Route::get('job/{id}/result', [InternalAiController::class, 'result'])->name('result');
    });

    // T-M5-014 — public temporary-signed media serve (NOT under auth:sanctum;
    // the signed URL is the auth). The `signed` middleware
    // rejects expired or tampered signatures with 403.
    Route::get('media/{media}/serve', [MediaController::class, 'serve'])->middleware('signed')->name('api.v1.media.serve');

    // Citizen PWA — report submission and read-back (M4)
    Route::middleware(['auth:sanctum', 'throttle:'.RouteServiceProvider::LIMITER_CITIZEN])->group(function (): void {
        // T-M4-022 — POST /api/v1/reports
        Route::post('reports', [ReportsController::class, 'store'])->name('api.v1.reports.store');
        // T-M5-012 — POST /api/v1/reports/{id}/photos
        Route::post('reports/{id}/photos', [MediaController::class, 'uploadPhotos'])->name('api.v1.reports.photos.store');
        // T-M5-013 — POST /api/v1/reports/{id}/video
        Route::post('reports/{id}/video', [MediaController::class, 'uploadVideo'])->name('api.v1.reports.video.store');
        // T-M5-014 — GET /api/v1/reports/{id}/media
        Route::get('reports/{id}/media', [MediaController::class, 'index'])->name('api.v1.reports.media.index');
        // T-M5-016 — GET /api/v1/reports/{id}/media/{media}/audit (staff)
        Route::get('reports/{id}/media/{media}/audit', [MediaController::class, 'audit'])->name('api.v1.reports.media.audit');
        // T-M4-023 — POST /api/v1/reports/{id}/submit
        Route::post('reports/{id}/submit', [ReportsController::class, 'submit'])->name('api.v1.reports.submit');
        // T-M4-027 — GET /api/v1/citizen/dashboard
        Route::get('citizen/dashboard', [ReportsController::class, 'citizenDashboard'])->name('api.v1.citizen.dashboard');
        // T-M4-028 — GET /api/v1/citizen/reports and /{id}
        Route::get('citizen/reports', [ReportsController::class, 'citizenIndex'])->name('api.v1.citizen.reports.index');
        Route::get('citizen/reports/{id}', [ReportsController::class, 'citizenShow'])->name('api.v1.citizen.reports.show');
    });

    // Staff (moderator / super_admin) — report search and timeline (M4)
    Route::middleware([
        'auth:sanctum',
        'throttle:'.RouteServiceProvider::LIMITER_MODERATOR,
    ])->group(function (): void {
        // T-M4-025 — GET /api/v1/reports (staff search)
        Route::get('reports', [ReportsController::class, 'index'])->name('api.v1.reports.index');
        // T-M4-024 — GET /api/v1/reports/{id}
        Route::get('reports/{id}', [ReportsController::class, 'show'])->name('api.v1.reports.show');
        // T-M4-026 — GET /api/v1/reports/{id}/timeline
        Route::get('reports/{id}/timeline', [ReportsController::class, 'timeline'])->name('api.v1.reports.timeline');
    });
});
