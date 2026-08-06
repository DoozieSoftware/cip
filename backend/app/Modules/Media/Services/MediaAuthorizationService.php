<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Responses\ApiResponse;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaAuthorizationService
{
    public function assertCanModifyMedia(Request $request, string $reportId): ?JsonResponse
    {
        $report = Report::query()->find($reportId);

        if ($report === null) {
            return ApiResponse::error('Report not found', 404, 'REPORT_NOT_FOUND');
        }

        $user = $request->user('sanctum');

        if (! $user instanceof User) {
            return ApiResponse::error('Authentication required', 401, 'UNAUTHENTICATED');
        }

        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;

        if (! $isOwner && ! DepartmentScope::canViewReport($user, $report)) {
            return ApiResponse::error('You cannot add media to this report.', 403, 'FORBIDDEN');
        }

        return null;
    }
}
