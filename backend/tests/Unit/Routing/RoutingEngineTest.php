<?php

declare(strict_types=1);

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Models\RoutingRule;
use App\Modules\Routing\Services\RoutingCondition;
use App\Modules\Routing\Services\RoutingEngine;
use App\Modules\Routing\ValueObjects\RoutingDecision;
use App\Modules\Users\Models\User;

beforeEach(function (): void {
    $this->evaluator = new RoutingCondition;
    $this->engine = new RoutingEngine($this->evaluator);

    $this->typePothole = new ReportType(['code' => 'pothole', 'name' => 'Pothole']);
    $this->priHigh = makePri('pri-high', 'high', 60);
    $this->priLow = makePri('pri-low', 'low', 4320);

    $this->report = new Report([
        'title' => 'Pothole on 5th Avenue',
        'description' => 'A large pothole',
        'ai_label' => 'pothole',
    ]);
    $this->report->setRelation('reportType', $this->typePothole);
    $this->report->setRelation('priority', $this->priHigh);
});

function makeDept(string $id, string $code = 'X', string $name = 'X'): Department
{
    $d = new Department;
    $d->setRawAttributes(['id' => $id, 'code' => $code, 'name' => $name, 'active' => true]);

    return $d;
}

function makePri(string $id, string $code, int $slaMinutes = 1440): ReportPriority
{
    $p = new ReportPriority;
    $p->setRawAttributes(['id' => $id, 'code' => $code, 'name' => $code, 'sla_minutes' => $slaMinutes, 'sort_order' => 0, 'active' => true]);

    return $p;
}

function makeUser(string $id, string $name = 'Officer'): User
{
    $u = new User;
    $u->setRawAttributes(['id' => $id, 'name' => $name]);

    return $u;
}

function buildRule(array $attrs, ?Department $dept = null, ?ReportPriority $pri = null, ?User $officer = null): RoutingRule
{
    $rule = new RoutingRule(array_merge([
        'name' => 'rule',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => 'dept-fake',
        'default_officer_id' => null,
        'default_priority_id' => 'pri-fake',
        'default_sla_minutes' => 1440,
        'active' => true,
    ], $attrs));

    if ($dept !== null) {
        $rule->setRelation('destinationDepartment', $dept);
    }

    if ($pri !== null) {
        $rule->setRelation('defaultPriority', $pri);
    }

    if ($officer !== null) {
        $rule->setRelation('defaultOfficer', $officer);
    }

    return $rule;
}

it('returns null when there are no rules', function (): void {
    expect($this->engine->resolveWith($this->report, []))->toBeNull();
});

it('returns null when no rule matches', function (): void {
    $dept = makeDept('d-1');
    $rules = [
        buildRule(['conditions' => ['category_in' => ['streetlight']]], $dept, $this->priHigh),
    ];

    expect($this->engine->resolveWith($this->report, $rules))->toBeNull();
});

it('returns the first matching rule by ascending priority', function (): void {
    $deptA = makeDept('d-a', 'BBMP', 'BBMP');
    $deptB = makeDept('d-b', 'BTP', 'BTP');

    $rules = [
        buildRule(['priority' => 200, 'conditions' => []], $deptB, $this->priHigh),
        buildRule(['priority' => 100, 'conditions' => []], $deptA, $this->priHigh),
    ];

    $decision = $this->engine->resolveWith($this->report, $rules);
    expect($decision)->not->toBeNull();
    expect($decision->destinationDepartment->id)->toBe('d-a');
    expect($decision->matchedRule->priority)->toBe(100);
});

it('uses id (uuid-lex) as the tie-breaker for equal priority', function (): void {
    $deptA = makeDept('d-a', 'A', 'A');
    $deptB = makeDept('d-b', 'B', 'B');

    $ruleA = new RoutingRule;
    $ruleA->setRawAttributes(['id' => 'd-a', 'name' => 'a', 'priority' => 100, 'conditions' => '{}', 'destination_department_id' => 'd-a', 'default_priority_id' => 'pri-high', 'default_sla_minutes' => 1440, 'active' => true]);
    $ruleA->setRelation('destinationDepartment', $deptA);
    $ruleA->setRelation('defaultPriority', $this->priHigh);

    $ruleB = new RoutingRule;
    $ruleB->setRawAttributes(['id' => 'd-b', 'name' => 'b', 'priority' => 100, 'conditions' => '{}', 'destination_department_id' => 'd-b', 'default_priority_id' => 'pri-high', 'default_sla_minutes' => 1440, 'active' => true]);
    $ruleB->setRelation('destinationDepartment', $deptB);
    $ruleB->setRelation('defaultPriority', $this->priHigh);

    $decision = $this->engine->resolveWith($this->report, [$ruleB, $ruleA]);
    expect($decision->destinationDepartment->id)->toBe('d-a');
});

it('is deterministic for the same input and rule set', function (): void {
    $dept = makeDept('d-1');
    $rules = [
        buildRule(['priority' => 50, 'conditions' => []], $dept, $this->priHigh),
        buildRule(['priority' => 100, 'conditions' => []], $dept, $this->priLow),
    ];

    $d1 = $this->engine->resolveWith($this->report, $rules);
    $d2 = $this->engine->resolveWith($this->report, $rules);

    expect($d1->matchedRule->id)->toBe($d2->matchedRule->id)
        ->and($d1->destinationDepartment->id)->toBe($d2->destinationDepartment->id);
});

it('skips a non-matching rule and returns the next one', function (): void {
    $deptA = makeDept('d-a', 'A', 'A');
    $deptB = makeDept('d-b', 'B', 'B');

    $rules = [
        buildRule(['priority' => 50, 'conditions' => ['category_in' => ['streetlight']]], $deptA, $this->priHigh),
        buildRule(['priority' => 100, 'conditions' => []], $deptB, $this->priHigh),
    ];

    $decision = $this->engine->resolveWith($this->report, $rules);
    expect($decision->destinationDepartment->id)->toBe('d-b');
});

it('includes the default officer in the decision when set', function (): void {
    $dept = makeDept('d-1');
    $user = makeUser('u-1');
    $rules = [
        buildRule(['conditions' => [], 'default_officer_id' => 'u-1'], $dept, $this->priHigh, $user),
    ];

    $decision = $this->engine->resolveWith($this->report, $rules);
    expect($decision->defaultOfficer)->not->toBeNull()
        ->and($decision->defaultOfficer->id)->toBe('u-1');
});

it('includes the default priority and SLA in the decision', function (): void {
    $dept = makeDept('d-1');
    $rules = [
        buildRule(['conditions' => [], 'default_sla_minutes' => 720], $dept, $this->priHigh),
    ];

    $decision = $this->engine->resolveWith($this->report, $rules);
    expect($decision->defaultPriority->id)->toBe($this->priHigh->id)
        ->and($decision->defaultSlaMinutes)->toBe(720);
});

it('RoutingDecision::fromRule throws when destination department is missing', function (): void {
    $rule = new RoutingRule([
        'name' => 'r',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => 'd-fake',
        'default_priority_id' => 'p-fake',
        'default_sla_minutes' => 1440,
        'active' => true,
    ]);
    $rule->setRelation('defaultPriority', $this->priHigh);

    expect(fn () => RoutingDecision::fromRule($rule))
        ->toThrow(InvalidArgumentException::class);
});

it('RoutingDecision::fromRule throws when default priority is missing', function (): void {
    $dept = makeDept('d-1');
    $rule = new RoutingRule([
        'name' => 'r',
        'priority' => 100,
        'conditions' => [],
        'destination_department_id' => 'd-1',
        'default_priority_id' => 'p-fake',
        'default_sla_minutes' => 1440,
        'active' => true,
    ]);
    $rule->setRelation('destinationDepartment', $dept);

    expect(fn () => RoutingDecision::fromRule($rule))
        ->toThrow(InvalidArgumentException::class);
});
