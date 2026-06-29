<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\Events\DepartmentUpdated;
use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Repositories\DepartmentRepository;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * T-M11-009 — Department admin surface.
 *
 * The four operations an administrator (super_admin) can
 * perform on a single department beyond the standard
 * CRUD:
 *
 *  - attachOfficer / detachOfficer / updateOfficer
 *    (manages the `department_users` pivot)
 *  - updateAdmin (mutates default_sla_minutes,
 *    working_hours, holiday_calendar, escalation_matrix
 *    in one transactional write).
 *
 * All writes emit an `audit_logs` row and dispatch the
 * `DepartmentUpdated` event so the master-config cache
 * invalidator and the dashboard widgets can react.
 *
 * The class is intentionally small and read-friendly:
 * each method is a single business transaction.
 */
class DepartmentAdminService
{
    public function __construct(
        private readonly DepartmentRepository $repository,
    ) {}

    /**
     * Attach (or upsert) a user to the department's officer
     * pivot. Returns the pivot row's id.
     */
    public function attachOfficer(
        Department $dept,
        User $actor,
        string $userId,
        bool $isManager = false,
        ?\DateTimeInterface $assignedAt = null,
        ?Request $request = null,
    ): string {
        $user = User::query()->find($userId);
        if ($user === null) {
            throw ApiException::notFound('User');
        }

        if (! $user->hasAnyRole(['department', 'department_admin', 'moderator', 'super_admin'])) {
            throw new ApiException(
                'USER_NOT_STAFF',
                'User does not have a department-officer or staff role; refusing to attach to the department.',
                422,
            );
        }

        $assignedAt ??= now();

        return DB::transaction(function () use ($dept, $actor, $user, $isManager, $assignedAt, $request): string {
            // Use syncWithoutDetaching so re-attach is idempotent
            // and respects any pivot-level metadata. We persist
            // is_manager / assigned_at explicitly so a later
            // re-attach updates the audit-relevant fields.
            $dept->users()->syncWithoutDetaching([
                $user->getKey() => [
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'is_manager' => $isManager,
                    'assigned_at' => $assignedAt,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);

            $this->writeAudit(
                $actor,
                $dept,
                'department.officer_attached',
                ['user_id' => null, 'is_manager' => null, 'assigned_at' => null],
                ['user_id' => $user->getKey(), 'is_manager' => $isManager, 'assigned_at' => $assignedAt->format(DATE_ATOM)],
                $request,
            );

            // Refresh to pull the freshly-upserted pivot row id
            $pivot = $dept->users()->where('users.id', $user->getKey())->first()?->pivot;
            $pivotId = $pivot?->id;

            if (! is_string($pivotId) || $pivotId === '') {
                throw new ApiException('OFFICER_PIVOT_MISSING', 'Failed to materialise the pivot row.', 500);
            }

            return $pivotId;
        });
    }

    /**
     * Detach an officer from the department. Idempotent —
     * detaching a non-attached user returns 204 without
     * writing an audit row.
     */
    public function detachOfficer(
        Department $dept,
        User $actor,
        string $userId,
        ?Request $request = null,
    ): bool {
        $attached = $dept->users()->where('users.id', $userId)->exists();
        if (! $attached) {
            return false;
        }

        DB::transaction(function () use ($dept, $actor, $userId, $request): void {
            $dept->users()->detach($userId);

            $this->writeAudit(
                $actor,
                $dept,
                'department.officer_detached',
                ['user_id' => $userId],
                ['user_id' => null],
                $request,
            );
        });

        return true;
    }

    /**
     * Patch a subset of admin-only fields on a department.
     * Returns the refreshed department.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function updateAdmin(
        Department $dept,
        User $actor,
        array $attributes,
        ?Request $request = null,
    ): Department {
        $this->assertEscalationMatrixShape($attributes['escalation_matrix'] ?? null);
        $this->assertWorkingHoursShape($attributes['working_hours'] ?? null);
        $this->assertHolidayCalendarShape($attributes['holiday_calendar'] ?? null);

        $before = $dept->only([
            'default_sla_minutes',
            'working_hours',
            'holiday_calendar',
            'escalation_matrix',
        ]);

        $updated = DB::transaction(function () use ($dept, $actor, $attributes, $before, $request): Department {
            $dept->fill(array_filter(
                $attributes,
                static fn ($v, $k): bool => in_array($k, [
                    'default_sla_minutes',
                    'working_hours',
                    'holiday_calendar',
                    'escalation_matrix',
                ], true) && $v !== null,
                ARRAY_FILTER_USE_BOTH,
            ));
            $dept->save();

            $this->writeAudit(
                $actor,
                $dept,
                'department.admin_updated',
                $before,
                $dept->only([
                    'default_sla_minutes',
                    'working_hours',
                    'holiday_calendar',
                    'escalation_matrix',
                ]),
                $request,
            );

            return $dept->refresh();
        });

        DepartmentUpdated::dispatch(
            $updated->id,
            $before + $updated->toArray(),
            $updated->toArray(),
        );

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function writeAudit(
        User $actor,
        Department $dept,
        string $action,
        array $before,
        array $after,
        ?Request $request,
    ): void {
        $requestId = $request?->attributes->get('trace_id');

        AuditLog::query()->create([
            'user_id' => $actor->getKey(),
            'entity' => 'departments',
            'entity_id' => $dept->getKey(),
            'action' => $action,
            'before' => $before,
            'after' => $after,
            'ip' => $request?->ip(),
            'device_fingerprint' => null,
            'request_id' => is_string($requestId) ? $requestId : null,
            'created_at' => now(),
        ]);
    }

    private function assertEscalationMatrixShape(mixed $matrix): void
    {
        if ($matrix === null) {
            return;
        }
        if (! is_array($matrix)) {
            throw new ApiException('DEPARTMENT_ESCALATION_INVALID', 'escalation_matrix must be an array.', 422);
        }
        foreach ($matrix as $row) {
            if (! is_array($row) || ! isset($row['after_minutes'])) {
                throw new ApiException('DEPARTMENT_ESCALATION_INVALID', 'Each escalation_matrix row needs after_minutes.', 422);
            }
        }
    }

    private function assertWorkingHoursShape(mixed $hours): void
    {
        if ($hours === null) {
            return;
        }
        if (! is_array($hours)) {
            throw new ApiException('DEPARTMENT_WORKING_HOURS_INVALID', 'working_hours must be an array.', 422);
        }
        $allowed = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        foreach ($hours as $row) {
            if (! is_array($row) || ! isset($row['day'], $row['open'], $row['close'])) {
                throw new ApiException('DEPARTMENT_WORKING_HOURS_INVALID', 'Each working_hours row needs day, open, close.', 422);
            }
            if (! in_array($row['day'], $allowed, true)) {
                throw new ApiException('DEPARTMENT_WORKING_HOURS_INVALID', "Invalid day '{$row['day']}'.", 422);
            }
        }
    }

    private function assertHolidayCalendarShape(mixed $holidays): void
    {
        if ($holidays === null) {
            return;
        }
        if (! is_array($holidays)) {
            throw new ApiException('DEPARTMENT_HOLIDAY_INVALID', 'holiday_calendar must be an array.', 422);
        }
    }
}
