<?php

declare(strict_types=1);

use App\Modules\Workflow\ValueObjects\WorkflowDecision;

it('builds a positive decision with the required fields', function (): void {
    $d = WorkflowDecision::allow(
        toStateId: 'state-2',
        matchedTransitionId: 'trans-1',
        slaMinutes: 60,
        notifyBeforeMinutes: 10,
        reasons: ['matched event=submit from state=draft as moderator'],
    );
    expect($d->allowed)->toBeTrue();
    expect($d->toStateId)->toBe('state-2');
    expect($d->matchedTransitionId)->toBe('trans-1');
    expect($d->slaMinutes)->toBe(60);
    expect($d->notifyBeforeMinutes)->toBe(10);
    expect($d->reasons)->toHaveCount(1);
});

it('builds a negative decision without destination or matched transition', function (): void {
    $d = WorkflowDecision::deny(['no transition for event=submit from state=draft']);
    expect($d->allowed)->toBeFalse();
    expect($d->toStateId)->toBeNull();
    expect($d->matchedTransitionId)->toBeNull();
    expect($d->slaMinutes)->toBeNull();
    expect($d->notifyBeforeMinutes)->toBeNull();
    expect($d->reasons)->toBe(['no transition for event=submit from state=draft']);
});

it('rejects a positive decision with an empty toStateId', function (): void {
    WorkflowDecision::allow(toStateId: '', matchedTransitionId: 'trans-1');
})->throws(InvalidArgumentException::class);

it('rejects a positive decision without a matched transition id', function (): void {
    WorkflowDecision::allow(toStateId: 'state-2', matchedTransitionId: '');
})->throws(InvalidArgumentException::class);

it('rejects a negative decision with no reasons', function (): void {
    WorkflowDecision::deny(reasons: []);
})->throws(InvalidArgumentException::class);

it('rejects a negative decision that carries a toStateId (logic error)', function (): void {
    new WorkflowDecision(
        allowed: false,
        toStateId: 'state-2',
        reasons: ['oops'],
    );
})->throws(InvalidArgumentException::class);
