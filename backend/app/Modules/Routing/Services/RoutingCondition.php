<?php

declare(strict_types=1);

namespace App\Modules\Routing\Services;

use App\Modules\Reports\Models\Report;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * RoutingCondition DSL parser per docs/04 sec 12.
 *
 * The DSL is a JSON object evaluated against a `Report`:
 * each top-level key is an operator, its value is the
 * operator's argument. Multiple operators in the same
 * object are AND-joined by default. A top-level `or` key
 * holds a list of objects, each of which is OR-joined with
 * the rest of the conditions (so `{"or": [{...}, {...}]}`
 * means "match if any sub-object matches").
 *
 * Supported operators (case-insensitive keys):
 *
 *   - category_in    : report's report_type.code is in [str, ...]
 *   - ward_in        : report's location.ward_id is in [str, ...]
 *   - district_in    : report's location.district_id is in [str, ...]
 *   - severity_in    : report's priority.code is in [str, ...]
 *   - keyword_match  : case-insensitive substring match of
 *                      any keyword in (title + description)
 *   - time_of_day_between: [HH:MM, HH:MM] - matches the
 *                      report's submitted_at hour/minute
 *                      (falls back to now() if not set)
 *   - ai_label_in    : report's ai_label column is in [str, ...]
 *                      (the M10 vision engine populates this)
 *
 * Returns `true` if the report matches the rule.
 */
class RoutingCondition
{
    /**
     * @param  array<string, mixed>  $conditions
     */
    public function evaluate(array $conditions, Report $report): bool
    {
        if ($conditions === []) {
            return true; // Empty rule matches everything.
        }

        $orGroups = $this->extractOrGroups($conditions);
        $andGroup = $this->extractAndGroup($conditions);

        // AND-join the top-level operators that are not
        // reserved keys.
        foreach ($andGroup as $op => $arg) {
            if (! $this->applyOperator($op, $arg, $report)) {
                return false;
            }
        }

        // When the rule has OR groups, at least one OR
        // group MUST match (the AND part is mandatory;
        // the OR part is a list of alternatives). When
        // there are no OR groups, the AND result already
        // decides.
        if ($orGroups === []) {
            return true;
        }

        foreach ($orGroups as $group) {
            if ($this->evaluate($group, $report)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $conditions
     * @return list<array<string, mixed>>
     */
    private function extractOrGroups(array $conditions): array
    {
        if (! array_key_exists('or', $conditions)) {
            return [];
        }

        $or = $conditions['or'];

        if (! is_array($or)) {
            throw new InvalidArgumentException('The "or" key must hold a list of condition objects.');
        }

        $out = [];

        foreach ($or as $group) {
            if (! is_array($group)) {
                throw new InvalidArgumentException('Each "or" entry must be a condition object.');
            }
            /** @var array<string, mixed> $group */
            $out[] = $group;
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $conditions
     * @return array<string, mixed>
     */
    private function extractAndGroup(array $conditions): array
    {
        $out = [];

        foreach ($conditions as $k => $v) {
            if ($k === 'or') {
                continue;
            }

            if (! is_string($k)) {
                throw new InvalidArgumentException('Routing condition keys must be strings.');
            }
            $out[$k] = $v;
        }

        return $out;
    }

    /**
     * @param  mixed  $arg
     */
    private function applyOperator(string $op, $arg, Report $report): bool
    {
        return match (strtolower($op)) {
            'category_in' => $this->categoryIn($arg, $report),
            'ward_in' => $this->wardIn($arg, $report),
            'district_in' => $this->districtIn($arg, $report),
            'severity_in' => $this->severityIn($arg, $report),
            'keyword_match' => $this->keywordMatch($arg, $report),
            'time_of_day_between' => $this->timeOfDayBetween($arg, $report),
            'ai_label_in' => $this->aiLabelIn($arg, $report),
            default => throw new InvalidArgumentException("Unknown routing operator '{$op}'."),
        };
    }

    /**
     * @param  mixed  $arg
     */
    private function categoryIn($arg, Report $report): bool
    {
        $codes = $this->asStringList($arg, 'category_in');
        $type = $report->reportType;

        if ($type === null) {
            return false;
        }

        return in_array($type->code, $codes, true);
    }

    /**
     * @param  mixed  $arg
     */
    private function wardIn($arg, Report $report): bool
    {
        $ids = $this->asStringList($arg, 'ward_in');
        $wardId = $report->location?->ward_id;

        if ($wardId === null) {
            return false;
        }

        return in_array($wardId, $ids, true);
    }

    /**
     * @param  mixed  $arg
     */
    private function districtIn($arg, Report $report): bool
    {
        $ids = $this->asStringList($arg, 'district_in');
        $districtId = $report->location?->district_id;

        if ($districtId === null) {
            return false;
        }

        return in_array($districtId, $ids, true);
    }

    /**
     * @param  mixed  $arg
     */
    private function severityIn($arg, Report $report): bool
    {
        $codes = $this->asStringList($arg, 'severity_in');
        $priority = $report->priority;

        if ($priority === null) {
            return false;
        }

        return in_array($priority->code, $codes, true);
    }

    /**
     * @param  mixed  $arg
     */
    private function keywordMatch($arg, Report $report): bool
    {
        $keywords = $this->asStringList($arg, 'keyword_match');
        $haystack = strtolower(($report->title ?? '').' '.($report->description ?? ''));

        foreach ($keywords as $kw) {
            if ($kw !== '' && str_contains($haystack, strtolower($kw))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  mixed  $arg
     */
    private function timeOfDayBetween($arg, Report $report): bool
    {
        if (! is_array($arg) || count($arg) !== 2) {
            throw new InvalidArgumentException('time_of_day_between expects [start, end] HH:MM.');
        }

        [$start, $end] = $arg;
        $start = $this->parseHm((string) $start, 'time_of_day_between[0]');
        $end = $this->parseHm((string) $end, 'time_of_day_between[1]');

        $at = $report->submitted_at instanceof Carbon
            ? $report->submitted_at
            : Carbon::now();
        $now = $at->format('H:i');

        if ($start <= $end) {
            return $now >= $start && $now <= $end;
        }

        // Wraps midnight (e.g. 22:00 - 06:00).
        return $now >= $start || $now <= $end;
    }

    /**
     * @param  mixed  $arg
     */
    private function aiLabelIn($arg, Report $report): bool
    {
        $labels = $this->asStringList($arg, 'ai_label_in');
        $aiLabel = $report->ai_label;

        if ($aiLabel === null) {
            return false;
        }

        return in_array($aiLabel, $labels, true);
    }

    /**
     * @param  mixed  $value
     * @return list<string>
     */
    private function asStringList($value, string $op): array
    {
        if (! is_array($value)) {
            throw new InvalidArgumentException("Routing operator '{$op}' expects a list of strings.");
        }

        $out = [];

        foreach ($value as $v) {
            if (! is_string($v) && ! is_int($v)) {
                throw new InvalidArgumentException("Routing operator '{$op}' expects a list of strings.");
            }
            $out[] = (string) $v;
        }

        return $out;
    }

    private function parseHm(string $value, string $where): string
    {
        if (! preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/', $value)) {
            throw new InvalidArgumentException("{$where} must be HH:MM (24h).");
        }

        return $value;
    }
}
