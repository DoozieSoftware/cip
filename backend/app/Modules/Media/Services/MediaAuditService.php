<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Http\Responses\ApiResponse;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MediaAuditService
{
    public function __construct(
        private readonly ChainOfCustodyWriter $chainOfCustody,
    ) {}

    public function audit(string $reportId, string $media, Request $request): JsonResponse
    {
        $row = Media::query()->where('id', $media)->where('report_id', $reportId)->first();

        if ($row === null) {
            return ApiResponse::error('Media not found', 404, 'NOT_FOUND');
        }

        /** @var User|null $user */
        $user = $request->user('sanctum');

        if ($user === null || ! $user->hasAnyRole(['moderator', 'department_officer', 'department', 'super_admin', 'system'])) {
            return ApiResponse::error('Forbidden', 403, 'FORBIDDEN');
        }

        $report = Report::query()->find($reportId);

        if ($report !== null && ! DepartmentScope::canViewReport($user, $report)) {
            return ApiResponse::error('Forbidden', 403, 'FORBIDDEN');
        }

        $history = $this->chainOfCustody->historyFor($media);

        return new JsonResponse([
            'success' => true,
            'message' => 'OK',
            'data' => [
                'media_id' => $row->id,
                'audit' => $history->map(fn (MediaAccessLog $r): array => [
                    'id' => $r->id,
                    'event' => $r->event,
                    'actor_id' => $r->actor_id,
                    'ip' => $r->ip,
                    'user_agent' => $r->user_agent,
                    'metadata' => $r->metadata,
                    'created_at' => $r->created_at instanceof Carbon ? $r->created_at->toIso8601String() : null,
                ])->all(),
            ],
            'meta' => ['count' => $history->count()],
        ], 200);
    }
}
