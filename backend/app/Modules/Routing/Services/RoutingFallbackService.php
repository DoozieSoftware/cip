<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Shared\Exceptions\ApiException;

/**
 * Resolves the platform's "default" routing destination
 * for reports that no active routing rule claims.
 *
 * The default destination is stored as an `app_configs`
 * row keyed `routing_default_department_id` with a
 * `value` payload of `{"department_id": "<uuid>"}`. The
 * key is configurable so deployments can route unclaimed
 * reports to a Super Admin moderation team, a triage
 * team, or any department they choose.
 *
 * Per docs/09 sec 18 the absence of a configured
 * fallback is a hard failure: throwing
 * `ROUTING_FALLBACK_MISSING` (503) is preferred over
 * silently dropping the report into an undefined state.
 */
class RoutingFallbackService
{
    public const APP_CONFIG_KEY = 'routing_default_department_id';

    public const DEFAULT_SLA_MINUTES = 1440;

    public function defaultDepartment(): Department
    {
        $config = AppConfig::query()->where('key', self::APP_CONFIG_KEY)->first();

        if ($config === null) {
            throw ApiException::routingFallbackMissing();
        }

        $value = $config->value;

        if (! is_array($value) || ! isset($value['department_id']) || ! is_string($value['department_id']) || $value['department_id'] === '') {
            throw ApiException::routingFallbackMissing(
                'app_configs.routing_default_department_id is malformed; expected {"department_id":"<uuid>"}.',
            );
        }

        $department = Department::query()->find($value['department_id']);

        if ($department === null) {
            throw ApiException::routingFallbackMissing(
                "Configured fallback department '{$value['department_id']}' does not exist.",
            );
        }

        return $department;
    }

    /**
     * Wrap the default destination into a `RoutingDecision`
     * suitable for the `AssignmentService`. The priority and
     * SLA carry over from the report (the fallback honours
     * the moderator's earlier choice when present) and fall
     * back to "medium" / 24h.
     */
    public function decisionFor(Report $report): RoutingDecision
    {
        $department = $this->defaultDepartment();

        $priority = $report->priority_id !== null
            ? ReportPriority::query()->find($report->priority_id)
            : null;

        if ($priority === null) {
            $priority = ReportPriority::query()->where('code', 'medium')->first()
                ?? ReportPriority::query()->first();
        }

        if ($priority === null) {
            throw ApiException::serverError('No ReportPriority rows exist; the database is unseeded.');
        }

        return RoutingDecision::fromFallback(
            department: $department,
            officer: null,
            priority: $priority,
            slaMinutes: self::DEFAULT_SLA_MINUTES,
        );
    }
}
