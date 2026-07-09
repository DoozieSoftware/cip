<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Modules\AI\Http\Controllers\Admin\AiPromptAdminController;
use App\Modules\AI\Http\Controllers\Admin\AiProviderAdminController;
use App\Modules\AI\Http\Controllers\Internal\InternalAiController;
use App\Modules\Authentication\Http\Controllers\AuthController;
use App\Modules\Departments\Http\Controllers\Admin\AdminOrganizationController;
use App\Modules\Departments\Http\Controllers\Admin\DepartmentAdminController;
use App\Modules\Departments\Http\Controllers\Admin\DepartmentController;
use App\Modules\Departments\Http\Controllers\Api\DepartmentDashboardController;
use App\Modules\Departments\Http\Controllers\Api\DepartmentReportActionsController;
use App\Modules\Departments\Http\Controllers\Api\DepartmentReportExportController;
use App\Modules\Departments\Http\Controllers\Api\DepartmentReportListController;
use App\Modules\Integrations\Http\Controllers\Admin\AdminIntegrationController;
use App\Modules\Media\Http\Controllers\Admin\AdminStorageController;
use App\Modules\Media\Http\Controllers\Api\MediaController;
use App\Modules\Moderation\Http\Controllers\Api\AnalyticsController;
use App\Modules\Moderation\Http\Controllers\Api\ModerationActionsController;
use App\Modules\Moderation\Http\Controllers\Api\QueueController;
use App\Modules\Notifications\Http\Controllers\Admin\AdminNotificationConfigController;
use App\Modules\Notifications\Http\Controllers\Api\NotificationPreferenceController;
use App\Modules\Notifications\Http\Controllers\Api\NotificationsController;
use App\Modules\Notifications\Http\Controllers\Api\PushSubscriptionController;
use App\Modules\Public\Http\Controllers\PublicDepartmentPerformanceController;
use App\Modules\Public\Http\Controllers\PublicHeatmapController;
use App\Modules\Public\Http\Controllers\PublicStatsController;
use App\Modules\Reports\Http\Controllers\Admin\AdminReportTypeController;
use App\Modules\Reports\Http\Controllers\Api\ReportsController;
use App\Modules\Routing\Http\Controllers\Admin\ReassignController;
use App\Modules\Routing\Http\Controllers\Admin\RoutingAdminController;
use App\Modules\Security\Http\Controllers\Admin\AdminSecurityPolicyController;
use App\Modules\Security\Http\Controllers\Api\AuditLogController;
use App\Modules\Security\Http\Controllers\Api\SecurityDashboardController;
use App\Modules\Settings\Http\Controllers\Admin\AppConfigController;
use App\Modules\Settings\Http\Controllers\Admin\SettingController;
use App\Modules\Shared\Http\Controllers\Admin\PlatformHealthController;
use App\Modules\Shared\Http\Controllers\Admin\SchedulerController;
use App\Modules\Users\Http\Controllers\Admin\AdminPermissionController;
use App\Modules\Users\Http\Controllers\Admin\AdminRoleController;
use App\Modules\Users\Http\Controllers\Admin\AdminUserController;
use App\Modules\Workflow\Http\Controllers\Admin\WorkflowAdminController;
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

    // Public, unauthenticated platform stats (M17 Public Portal) — no
    // PII, no exact coordinates. Server-side cached.
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_PUBLIC)->group(function (): void {
        Route::get('public/stats', [PublicStatsController::class, 'index'])->name('api.v1.public.stats');
        Route::get('public/heatmap', [PublicHeatmapController::class, 'index'])->name('api.v1.public.heatmap');
        Route::get('public/departments/performance', [PublicDepartmentPerformanceController::class, 'index'])->name('api.v1.public.departments.performance');
    });

    // TEMP: one-shot OPcache clear so deploys go live while validate_timestamps
    // is disabled on the FPM pool. Hit once then removed. Runs inside the FPM
    // worker, so it clears THAT worker's cache; subsequent requests recompile.
    Route::get('__opcache_reset', function () {
        if (function_exists('opcache_reset')) {
            opcache_reset();
        }

        return response()->json(['ok' => true, 'opcache_reset' => function_exists('opcache_reset')]);
    })->name('api.v1.__opcache_reset');

    // Auth (M2) — rate limited per docs/11 §21.
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_OTP)
        ->post('auth/send-otp', [AuthController::class, 'sendOtp'])
        ->name('api.v1.auth.send-otp');
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_CITIZEN)->group(function (): void {
        Route::post('auth/verify-otp', [AuthController::class, 'verifyOtp'])->name('api.v1.auth.verify-otp');
        Route::post('auth/refresh', [AuthController::class, 'refresh'])->name('api.v1.auth.refresh');
    });
    // Staff password login (docs/11 §8) — citizens are OTP-only.
    Route::middleware('throttle:'.RouteServiceProvider::LIMITER_LOGIN)
        ->post('auth/login', [AuthController::class, 'login'])
        ->name('api.v1.auth.login');

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'throttle:'.RouteServiceProvider::LIMITER_CITIZEN])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');

        // Notifications inbox (T-M9-015/016)
        Route::get('notifications', [NotificationsController::class, 'index'])->name('notifications.index');
        Route::post('notifications/{id}/read', [NotificationsController::class, 'markRead'])->name('notifications.read');
        Route::get('notifications/preferences', [NotificationPreferenceController::class, 'index'])->name('notifications.preferences.index');
        Route::put('notifications/preferences', [NotificationPreferenceController::class, 'update'])->name('notifications.preferences.update');

        // Web Push subscriptions (T-M13)
        Route::get('notifications/push/vapid-public-key', [PushSubscriptionController::class, 'vapidPublicKey'])->name('notifications.push.vapid');
        Route::post('notifications/push/subscriptions', [PushSubscriptionController::class, 'store'])->name('notifications.push.store');
        Route::delete('notifications/push/subscriptions', [PushSubscriptionController::class, 'destroy'])->name('notifications.push.destroy');
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

        // T-M11-019 — Audit log search (super_admin / auditor / department_admin)
        Route::get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
        // T-M11-020 — Security dashboard (super_admin / auditor / department_admin)
        Route::get('security/dashboard', [SecurityDashboardController::class, 'index'])->name('security.dashboard');
        // T-M12-001 — User CRUD (super_admin)
        Route::get('users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('users', [AdminUserController::class, 'store'])->name('users.store');
        Route::get('users/{user}', [AdminUserController::class, 'show'])->name('users.show');
        Route::put('users/{user}', [AdminUserController::class, 'update'])->name('users.update');
        Route::delete('users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');
        Route::post('users/{user}/restore', [AdminUserController::class, 'restore'])->name('users.restore');
        // T-M12-002 — Role + Permission directory (super_admin only)
        Route::get('roles', [AdminRoleController::class, 'index'])->name('roles.index');
        Route::post('roles', [AdminRoleController::class, 'store'])->name('roles.store');
        Route::get('roles/{role}', [AdminRoleController::class, 'show'])->name('roles.show');
        Route::put('roles/{role}', [AdminRoleController::class, 'update'])->name('roles.update');
        Route::delete('roles/{role}', [AdminRoleController::class, 'destroy'])->name('roles.destroy');
        Route::post('roles/{role}/permissions/sync', [AdminRoleController::class, 'syncPermissionsEndpoint'])->name('roles.permissions.sync');
        Route::get('permissions', [AdminPermissionController::class, 'index'])->name('permissions.index');
        Route::post('permissions', [AdminPermissionController::class, 'store'])->name('permissions.store');
        Route::get('permissions/{permission}', [AdminPermissionController::class, 'show'])->name('permissions.show');
        Route::delete('permissions/{permission}', [AdminPermissionController::class, 'destroy'])->name('permissions.destroy');

        // T-M12-003 — Report-type CRUD (super_admin)
        Route::get('report-types', [AdminReportTypeController::class, 'index'])->name('report-types.index');
        Route::post('report-types', [AdminReportTypeController::class, 'store'])->name('report-types.store');
        Route::get('report-types/{report_type}', [AdminReportTypeController::class, 'show'])->name('report-types.show');
        Route::put('report-types/{report_type}', [AdminReportTypeController::class, 'update'])->name('report-types.update');
        Route::delete('report-types/{report_type}', [AdminReportTypeController::class, 'destroy'])->name('report-types.destroy');
        Route::post('report-types/{report_type}/restore', [AdminReportTypeController::class, 'restore'])->name('report-types.restore');

        Route::get('security-policies', [AdminSecurityPolicyController::class, 'index'])->name('security-policies.index');
        Route::post('security-policies', [AdminSecurityPolicyController::class, 'store'])->name('security-policies.store');
        Route::get('security-policies/{key}', [AdminSecurityPolicyController::class, 'show'])->name('security-policies.show');
        Route::put('security-policies/{key}', [AdminSecurityPolicyController::class, 'update'])->name('security-policies.update');
        Route::delete('security-policies/{key}', [AdminSecurityPolicyController::class, 'destroy'])->name('security-policies.destroy');

        // T-M12-007 — Integrations CRUD (super_admin)
        Route::get('integrations', [AdminIntegrationController::class, 'index'])->name('integrations.index');
        Route::post('integrations', [AdminIntegrationController::class, 'store'])->name('integrations.store');
        Route::get('integrations/{integration}', [AdminIntegrationController::class, 'show'])->name('integrations.show');
        Route::put('integrations/{integration}', [AdminIntegrationController::class, 'update'])->name('integrations.update');
        Route::delete('integrations/{integration}', [AdminIntegrationController::class, 'destroy'])->name('integrations.destroy');
        Route::post('integrations/{integration}/restore', [AdminIntegrationController::class, 'restore'])->name('integrations.restore');
        Route::post('integrations/{integration}/health', [AdminIntegrationController::class, 'health'])->name('integrations.health');
        // T-M12-008 — Media storage config (super_admin)
        Route::get('media/storage', [AdminStorageController::class, 'show'])->name('media.storage.show');
        Route::put('media/storage', [AdminStorageController::class, 'update'])->name('media.storage.update');
        Route::post('media/storage/probe', [AdminStorageController::class, 'probe'])->name('media.storage.probe');
        // T-M12-009 — Notification channel configs (super_admin)
        Route::get('notification-configs', [AdminNotificationConfigController::class, 'index'])->name('notification-configs.index');
        Route::post('notification-configs', [AdminNotificationConfigController::class, 'store'])->name('notification-configs.store');
        Route::get('notification-configs/{config}', [AdminNotificationConfigController::class, 'show'])->name('notification-configs.show');
        Route::put('notification-configs/{config}', [AdminNotificationConfigController::class, 'update'])->name('notification-configs.update');
        Route::delete('notification-configs/{config}', [AdminNotificationConfigController::class, 'destroy'])->name('notification-configs.destroy');
        Route::post('notification-configs/{config}/restore', [AdminNotificationConfigController::class, 'restore'])->name('notification-configs.restore');
        // T-M12-012 — Scheduler dashboard (super_admin)
        Route::get('scheduler/jobs', [SchedulerController::class, 'index'])->name('scheduler.jobs.index');
        Route::post('scheduler/jobs/{id}/run-now', [SchedulerController::class, 'runNow'])->name('scheduler.jobs.run-now');
        Route::post('scheduler/jobs/{id}/pause', [SchedulerController::class, 'pause'])->name('scheduler.jobs.pause');
        Route::post('scheduler/jobs/{id}/resume', [SchedulerController::class, 'resume'])->name('scheduler.jobs.resume');
        // T-M12-013 — Organizations CRUD (super_admin)
        Route::get('organizations', [AdminOrganizationController::class, 'index'])->name('organizations.index');
        Route::post('organizations', [AdminOrganizationController::class, 'store'])->name('organizations.store');
        Route::get('organizations/{organization}', [AdminOrganizationController::class, 'show'])->name('organizations.show');
        Route::put('organizations/{organization}', [AdminOrganizationController::class, 'update'])->name('organizations.update');
        Route::delete('organizations/{organization}', [AdminOrganizationController::class, 'destroy'])->name('organizations.destroy');
        Route::post('organizations/{organization}/restore', [AdminOrganizationController::class, 'restore'])->name('organizations.restore');
        // T-M12-015 — Platform health (super_admin)
        Route::get('health', [PlatformHealthController::class, 'show'])->name('health.summary');
        Route::get('health/components', [PlatformHealthController::class, 'components'])->name('health.components');

        // T-M11-009 — Department admin surface (officers, SLAs,
        // working hours, holiday calendar).
        Route::prefix('departments/{department}')->name('departments.')->group(function (): void {
            Route::get('officers', [DepartmentAdminController::class, 'listOfficers'])->name('officers.index');
            Route::post('officers', [DepartmentAdminController::class, 'attachOfficer'])->name('officers.store');
            Route::delete('officers/{user}', [DepartmentAdminController::class, 'detachOfficer'])->name('officers.destroy');
            Route::patch('admin', [DepartmentAdminController::class, 'updateAdmin'])->name('admin.update');
        });

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
        Route::post('ai/providers/{provider}/test', [AiProviderAdminController::class, 'test'])->name('ai.providers.test');
        Route::post('ai/providers/{provider}/activate', [AiProviderAdminController::class, 'activate'])->name('ai.providers.activate');

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

    // Moderator portal (M10) — gated to the `moderator` role; rate
    // limited with the moderator limiter.
    Route::middleware([
        'auth:sanctum',
        'throttle:'.RouteServiceProvider::LIMITER_MODERATOR,
    ])->prefix('moderator')->name('api.v1.moderator.')->group(function (): void {
        // T-M10-008 — review queue
        Route::get('queue', [QueueController::class, 'queue'])->name('queue');
        // T-M10-009 — duplicate queue
        Route::get('duplicates', [QueueController::class, 'duplicates'])->name('duplicates');
        // T-M10-010 — fraud queue
        Route::get('fraud', [QueueController::class, 'fraud'])->name('fraud');
        // Per-report moderation detail (companion of the queue endpoints).
        Route::get('reports/{report}', [QueueController::class, 'show'])->name('reports.show');
        Route::get('analytics/summary', [AnalyticsController::class, 'summary'])->name('analytics.summary');
        Route::get('analytics/ai-performance', [AnalyticsController::class, 'aiPerformance'])->name('analytics.ai-performance');
        // T-M10-011 — four action endpoints
        Route::post('reports/{report}/review', [ModerationActionsController::class, 'review'])->name('reports.review');
        Route::post('reports/{report}/merge', [ModerationActionsController::class, 'merge'])->name('reports.merge');
        Route::post('reports/{report}/reject', [ModerationActionsController::class, 'reject'])->name('reports.reject');
        Route::post('reports/{report}/escalate', [ModerationActionsController::class, 'escalate'])->name('reports.escalate');
    });

    // Operations portal (M11) — gated to the `department` role (and the
    // super_admin / system bypass through DepartmentPolicy::before()).
    // Rate limited with the department limiter.
    Route::middleware([
        'auth:sanctum',
        'throttle:'.RouteServiceProvider::LIMITER_DEPARTMENT,
    ])->prefix('department')->name('api.v1.department.')->group(function (): void {
        // T-M11-007 — dashboard summary
        Route::get('dashboard', [DepartmentDashboardController::class, 'show'])
            ->middleware('can:viewDashboard')
            ->name('dashboard');
        // T-M11-008 — paginated list
        Route::get('reports', [DepartmentReportListController::class, 'index'])
            ->middleware('can:viewReports')
            ->name('reports.index');
        // T-M11-010 — CSV / XLSX / PDF export
        Route::get('reports/export', [DepartmentReportExportController::class, 'export'])
            ->middleware('can:viewReports')
            ->name('reports.export');
        Route::get('reports/{report}', [DepartmentReportListController::class, 'show'])
            ->middleware('can:view,report')
            ->name('reports.show');
        // T-M11-006 — five lifecycle actions + T-M11-005 — internal note
        Route::post('reports/{report}/accept', [DepartmentReportActionsController::class, 'accept'])
            ->middleware('can:accept,report')
            ->name('reports.accept');
        Route::post('reports/{report}/start', [DepartmentReportActionsController::class, 'start'])
            ->middleware('can:start,report')
            ->name('reports.start');
        Route::post('reports/{report}/progress', [DepartmentReportActionsController::class, 'progress'])
            ->middleware('can:progress,report')
            ->name('reports.progress');
        Route::post('reports/{report}/resolve', [DepartmentReportActionsController::class, 'resolve'])
            ->middleware('can:resolve,report')
            ->name('reports.resolve');
        Route::post('reports/{report}/close', [DepartmentReportActionsController::class, 'close'])
            ->middleware('can:close,report')
            ->name('reports.close');
        // T-M11-005 — internal note (department-private)
        Route::post('reports/{report}/note', [DepartmentReportActionsController::class, 'addNote'])
            ->middleware('can:addNote,report')
            ->name('reports.note');
        Route::get('reports/{report}/notes', [DepartmentReportActionsController::class, 'listNotes'])
            ->middleware('can:view,report')
            ->name('reports.notes.index');
    });

    // Citizen PWA — report submission and read-back (M4)
    Route::middleware(['auth:sanctum', 'throttle:'.RouteServiceProvider::LIMITER_CITIZEN])->group(function (): void {
        // Report types for citizen submit form (active only)
        Route::get('report-types', [ReportsController::class, 'reportTypes'])->name('api.v1.report-types.index');
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
