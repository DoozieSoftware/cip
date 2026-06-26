<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use InvalidArgumentException;

/**
 * Evaluates the JSON `conditions` DSL stored on a
 * `workflow_transitions` row.
 *
 * A condition set is a map of attribute-path to operator.
 * All keys must match; AND-semantics. Example:
 *
 * ```json
 * {
 *   "fraud_score":   { "lte": 0.3 },
 *   "is_anonymous":  { "eq": false },
 *   "ai_confidence": { "gte": 0.6 }
 * }
 * ```
 *
 * Supported operators (per docs/04 §11):
 *
 *  - `eq`     : strict equality
 *  - `ne`     : strict inequality
 *  - `in`     : value is in the given list
 *  - `not_in` : value is not in the given list
 *  - `gt`     : greater than
 *  - `gte`    : greater than or equal
 *  - `lt`     : less than
 *  - `lte`    : less than or equal
 *  - `between`: [min, max] inclusive
 *  - `truthy` : value is truthy (any non-null/false/empty value)
 *  - `falsy`  : value is falsy
 *
 * Attribute paths may be dotted. Two root namespaces are
 * recognised: the `report.*` and `actor.*` prefixes, plus
 * bare paths on the Report model (`ai_confidence`,
 * `fraud_score`, `is_anonymous`, ...).
 */
class ConditionEvaluator
{
    private const OPERATORS = [
        'eq', 'ne', 'in', 'not_in',
        'gt', 'gte', 'lt', 'lte',
        'between', 'truthy', 'falsy',
    ];

    /**
     * @param  array<string, array<string, mixed>>  $conditions
     */
    public function matches(array $conditions, Report $report, User $actor): bool
    {
        if ($conditions === []) {
            return true;
        }

        $ctx = $this->buildContext($report, $actor);

        foreach ($conditions as $path => $ops) {
            $value = $this->resolve($path, $ctx);
            $ops = is_array($ops) ? $ops : ['eq' => $ops];

            foreach ($ops as $op => $expected) {
                if (! in_array($op, self::OPERATORS, true)) {
                    throw new InvalidArgumentException(
                        "Unknown condition operator '{$op}' on path '{$path}'."
                    );
                }

                if (! $this->apply($value, $op, $expected)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildContext(Report $report, User $actor): array
    {
        return [
            'report' => [
                'id' => $report->id,
                'ai_confidence' => $report->ai_confidence,
                'fraud_score' => $report->fraud_score,
                'duplicate_score' => $report->duplicate_score,
                'is_anonymous' => (bool) $report->is_anonymous,
                'is_verified' => (bool) $report->is_verified,
                'citizen_id' => $report->citizen_id,
                'department_id' => $report->department_id,
                'current_status_id' => $report->current_status_id,
                'priority_id' => $report->priority_id,
                'report_type_id' => $report->report_type_id,
            ],
            'actor' => [
                'id' => $actor->id,
                'roles' => $actor->roles()->pluck('name')->all(),
                'is_anonymous_actor' => false,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $ctx
     */
    private function resolve(string $path, array $ctx): mixed
    {
        if (str_contains($path, '.')) {
            $parts = explode('.', $path, 2);

            return data_get($ctx, $path);
        }

        // Bare path — search the report first, then the actor.
        if (array_key_exists($path, $ctx['report'])) {
            return $ctx['report'][$path];
        }

        if (array_key_exists($path, $ctx['actor'])) {
            return $ctx['actor'][$path];
        }

        return null;
    }

    private function apply(mixed $value, string $op, mixed $expected): bool
    {
        return match ($op) {
            'eq' => $value === $expected,
            'ne' => $value !== $expected,
            'in' => is_array($expected) && in_array($value, $expected, false),
            'not_in' => is_array($expected) && ! in_array($value, $expected, false),
            'gt' => is_numeric($value) && is_numeric($expected) && $value > $expected,
            'gte' => is_numeric($value) && is_numeric($expected) && $value >= $expected,
            'lt' => is_numeric($value) && is_numeric($expected) && $value < $expected,
            'lte' => is_numeric($value) && is_numeric($expected) && $value <= $expected,
            'between' => is_array($expected) && count($expected) === 2
                && is_numeric($value) && $value >= $expected[0] && $value <= $expected[1],
            'truthy' => (bool) $value,
            'falsy' => ! $value,
        };
    }
}
