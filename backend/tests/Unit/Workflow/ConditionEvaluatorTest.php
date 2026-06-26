<?php

declare(strict_types=1);

use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Services\ConditionEvaluator;

beforeEach(function (): void {
    $this->evaluator = new ConditionEvaluator;
    $this->report = Report::factory()->make([
        'ai_confidence' => 0.7,
        'fraud_score' => 0.2,
        'duplicate_score' => 0.1,
        'is_anonymous' => false,
        'is_verified' => false,
        'citizen_id' => null,
    ]);
    $this->actor = User::factory()->make(['id' => '00000000-0000-7000-8000-000000000001']);
});

it('returns true on an empty condition set (no constraint)', function (): void {
    expect($this->evaluator->matches([], $this->report, $this->actor))->toBeTrue();
});

it('evaluates eq (strict equality)', function (): void {
    expect($this->evaluator->matches(['is_anonymous' => ['eq' => false]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['is_anonymous' => ['eq' => true]], $this->report, $this->actor))->toBeFalse();
});

it('evaluates ne (strict inequality)', function (): void {
    expect($this->evaluator->matches(['is_anonymous' => ['ne' => true]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['is_anonymous' => ['ne' => false]], $this->report, $this->actor))->toBeFalse();
});

it('evaluates in / not_in', function (): void {
    expect($this->evaluator->matches(['current_status_id' => ['in' => ['a', 'b']]], $this->report, $this->actor))->toBeFalse();
    $this->report->current_status_id = 'a';
    expect($this->evaluator->matches(['current_status_id' => ['in' => ['a', 'b']]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['current_status_id' => ['not_in' => ['a', 'b']]], $this->report, $this->actor))->toBeFalse();
});

it('evaluates gt / gte / lt / lte', function (): void {
    expect($this->evaluator->matches(['ai_confidence' => ['gt' => 0.5]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['ai_confidence' => ['gt' => 0.7]], $this->report, $this->actor))->toBeFalse();
    expect($this->evaluator->matches(['ai_confidence' => ['gte' => 0.7]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['fraud_score' => ['lt' => 0.3]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['fraud_score' => ['lte' => 0.2]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['fraud_score' => ['lte' => 0.19]], $this->report, $this->actor))->toBeFalse();
});

it('evaluates between (inclusive [min, max])', function (): void {
    expect($this->evaluator->matches(['fraud_score' => ['between' => [0.0, 0.3]]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['fraud_score' => ['between' => [0.21, 0.5]]], $this->report, $this->actor))->toBeFalse();
});

it('evaluates truthy / falsy', function (): void {
    expect($this->evaluator->matches(['citizen_id' => ['truthy' => true]], $this->report, $this->actor))->toBeFalse();
    $this->report->citizen_id = 'abc';
    expect($this->evaluator->matches(['citizen_id' => ['truthy' => true]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['citizen_id' => ['falsy' => true]], $this->report, $this->actor))->toBeFalse();
});

it('resolves dotted paths (report.fraud_score / actor.id)', function (): void {
    expect($this->evaluator->matches(['report.fraud_score' => ['lte' => 0.3]], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['actor.id' => ['truthy' => true]], $this->report, $this->actor))->toBeTrue();
});

it('combines multiple keys with AND-semantics', function (): void {
    $conds = [
        'fraud_score' => ['lte' => 0.3],
        'ai_confidence' => ['gte' => 0.6],
    ];
    expect($this->evaluator->matches($conds, $this->report, $this->actor))->toBeTrue();

    $this->report->fraud_score = 0.9;
    expect($this->evaluator->matches($conds, $this->report, $this->actor))->toBeFalse();
});

it('rejects unknown operators with a typed exception', function (): void {
    $this->evaluator->matches(['fraud_score' => ['approx' => 0.2]], $this->report, $this->actor);
})->throws(InvalidArgumentException::class);

it('accepts a single scalar operator shorthand', function (): void {
    // `fraud_score: 0.2` is the shorthand for `{fraud_score: {eq: 0.2}}`
    expect($this->evaluator->matches(['fraud_score' => 0.2], $this->report, $this->actor))->toBeTrue();
    expect($this->evaluator->matches(['fraud_score' => 0.9], $this->report, $this->actor))->toBeFalse();
});
