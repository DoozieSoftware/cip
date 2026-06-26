<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Services\RoutingCondition;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->evaluator = new RoutingCondition;

    $this->reportType = new ReportType(['code' => 'pothole', 'name' => 'Pothole']);
    $this->priority = new ReportPriority(['code' => 'high', 'name' => 'High', 'sla_minutes' => 60, 'sort_order' => 0, 'active' => true]);
    $this->location = new Location([
        'ward_id' => 'ward-1',
        'district_id' => 'district-a',
    ]);
    $this->report = new Report([
        'title' => 'Pothole on 5th Avenue',
        'description' => 'A large pothole is blocking the right lane.',
        'ai_label' => 'pothole',
    ]);
    $this->report->setRelation('reportType', $this->reportType);
    $this->report->setRelation('priority', $this->priority);
    $this->report->setRelation('location', $this->location);
});

it('returns true for an empty condition set (matches everything)', function (): void {
    expect($this->evaluator->evaluate([], $this->report))->toBeTrue();
});

it('evaluates category_in against the report_type.code', function (): void {
    expect($this->evaluator->evaluate(['category_in' => ['pothole']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['category_in' => ['streetlight']], $this->report))->toBeFalse();
    expect($this->evaluator->evaluate(['category_in' => ['pothole', 'garbage']], $this->report))->toBeTrue();
});

it('evaluates ward_in against the location.ward_id', function (): void {
    expect($this->evaluator->evaluate(['ward_in' => ['ward-1']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['ward_in' => ['ward-2']], $this->report))->toBeFalse();
});

it('evaluates district_in against the location.district_id', function (): void {
    expect($this->evaluator->evaluate(['district_in' => ['district-a']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['district_in' => ['district-b']], $this->report))->toBeFalse();
});

it('evaluates severity_in against the priority.code', function (): void {
    expect($this->evaluator->evaluate(['severity_in' => ['high']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['severity_in' => ['low']], $this->report))->toBeFalse();
});

it('evaluates keyword_match case-insensitively in title + description', function (): void {
    expect($this->evaluator->evaluate(['keyword_match' => ['POTHOLE']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['keyword_match' => ['lane']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['keyword_match' => ['sidewalk']], $this->report))->toBeFalse();
});

it('evaluates keyword_match with multiple keywords (OR semantics)', function (): void {
    expect($this->evaluator->evaluate(['keyword_match' => ['banana', 'pothole']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['keyword_match' => ['banana', 'apple']], $this->report))->toBeFalse();
});

it('evaluates ai_label_in against the report ai_label', function (): void {
    expect($this->evaluator->evaluate(['ai_label_in' => ['pothole']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['ai_label_in' => ['streetlight']], $this->report))->toBeFalse();
});

it('returns false for ai_label_in when ai_label is null', function (): void {
    $report = $this->report;
    $report->ai_label = null;
    expect($this->evaluator->evaluate(['ai_label_in' => ['pothole']], $report))->toBeFalse();
});

it('evaluates time_of_day_between in the inclusive range', function (): void {
    Carbon::setTestNow(Carbon::parse('2026-06-27 10:30'));
    expect($this->evaluator->evaluate(['time_of_day_between' => ['09:00', '11:00']], $this->report))->toBeTrue();
    expect($this->evaluator->evaluate(['time_of_day_between' => ['11:00', '12:00']], $this->report))->toBeFalse();
    Carbon::setTestNow();
});

it('evaluates time_of_day_between that wraps midnight', function (): void {
    Carbon::setTestNow(Carbon::parse('2026-06-27 23:30'));
    expect($this->evaluator->evaluate(['time_of_day_between' => ['22:00', '06:00']], $this->report))->toBeTrue();

    Carbon::setTestNow(Carbon::parse('2026-06-27 12:00'));
    expect($this->evaluator->evaluate(['time_of_day_between' => ['22:00', '06:00']], $this->report))->toBeFalse();
    Carbon::setTestNow();
});

it('combines multiple operators with AND semantics', function (): void {
    $cond = [
        'category_in' => ['pothole'],
        'ward_in' => ['ward-1'],
        'severity_in' => ['high'],
    ];
    expect($this->evaluator->evaluate($cond, $this->report))->toBeTrue();

    $cond2 = [
        'category_in' => ['pothole'],
        'ward_in' => ['ward-2'],
    ];
    expect($this->evaluator->evaluate($cond2, $this->report))->toBeFalse();
});

it('supports a top-level or group of sub-conditions', function (): void {
    $cond = [
        'or' => [
            ['ward_in' => ['ward-2']],
            ['category_in' => ['pothole']],
        ],
    ];
    expect($this->evaluator->evaluate($cond, $this->report))->toBeTrue();
});

it('combines the top-level and with the top-level or', function (): void {
    $cond = [
        'severity_in' => ['high'],
        'or' => [
            ['ward_in' => ['ward-1']],
            ['category_in' => ['streetlight']],
        ],
    ];
    expect($this->evaluator->evaluate($cond, $this->report))->toBeTrue();
});

it('returns false when and operators match but no or-group matches', function (): void {
    $cond = [
        'severity_in' => ['high'],
        'or' => [
            ['ward_in' => ['ward-2']],
        ],
    ];
    expect($this->evaluator->evaluate($cond, $this->report))->toBeFalse();
});

it('throws on an unknown operator', function (): void {
    expect(fn () => $this->evaluator->evaluate(['no_such_op' => []], $this->report))
        ->toThrow(InvalidArgumentException::class);
});

it('throws on a non-list argument to an _in operator', function (): void {
    expect(fn () => $this->evaluator->evaluate(['category_in' => 'pothole'], $this->report))
        ->toThrow(InvalidArgumentException::class);
});

it('throws on a malformed time_of_day_between', function (): void {
    expect(fn () => $this->evaluator->evaluate(['time_of_day_between' => ['bad', '12:00']], $this->report))
        ->toThrow(InvalidArgumentException::class);
});
