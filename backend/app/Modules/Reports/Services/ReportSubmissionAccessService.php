<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Support\DepartmentScope;
use App\Modules\Users\Models\User;

final class ReportSubmissionAccessService
{
    private const STAFF_ROLES = [
        'moderator',
        'department_officer',
        'department',
        'super_admin',
        'system',
    ];

    public function authorize(User $user, Report $report): void
    {
        $isOwner = ! $report->is_anonymous
            && $report->citizen_id !== null
            && (string) $report->citizen_id === (string) $user->id;
        $isStaff = $user->hasAnyRole(self::STAFF_ROLES);

        if (! $isOwner && ! $isStaff) {
            throw ApiException::forbidden('You cannot submit this complaint.');
        }

        if (! $isOwner && ! DepartmentScope::canViewReport($user, $report)) {
            throw ApiException::forbidden('This complaint is outside your department scope.');
        }
    }
}
