<?php

declare(strict_types=1);

namespace App\Modules\Workflow\ValueObjects;

use InvalidArgumentException;

/**
 * Read-only decision returned by `WorkflowEngine::evaluate(...)`.
 *
 * The engine is the only thing that constructs this — the rest
 * of the codebase just reads the fields. Per docs/14 §10 a
 * decision is a value object: it is immutable, has no
 * dependencies on Eloquent, and is safe to log or serialize.
 *
 *  - allowed                : true when the engine found a
 *                             transition the actor is allowed
 *                             to fire from the current state
 *                             for the given event
 *  - toStateId              : the destination state id (null
 *                             when `allowed=false`)
 *  - matchedTransitionId    : the transition row that won the
 *                             priority tie-break (null when
 *                             `allowed=false`)
 *  - slaMinutes             : the SLA window from the winning
 *                             transition (null when the
 *                             transition has no SLA)
 *  - notifyBeforeMinutes    : the pre-breach notification lead
 *                             time (null when not configured)
 *  - reasons                : human-readable explanations for
 *                             the decision — `allowed` cases
 *                             carry the matched event and the
 *                             actor's role/permission, denied
 *                             cases carry the failure reasons
 *                             (e.g. "no transition for
 *                             event=submit from state=draft")
 */
final readonly class WorkflowDecision
{
    /**
     * @param  list<string>  $reasons
     */
    public function __construct(
        public bool $allowed,
        public ?string $toStateId = null,
        public ?string $matchedTransitionId = null,
        public ?int $slaMinutes = null,
        public ?int $notifyBeforeMinutes = null,
        public array $reasons = [],
    ) {
        if ($allowed) {
            if ($toStateId === null || $toStateId === '') {
                throw new InvalidArgumentException('A positive decision must carry a non-empty toStateId.');
            }

            if ($matchedTransitionId === null || $matchedTransitionId === '') {
                throw new InvalidArgumentException('A positive decision must reference the matched transition id.');
            }
        } else {
            // Defensive: a denied decision must not carry a
            // destination or matched transition (it would be
            // a logic error in the engine, not an end-user
            // condition).
            if ($toStateId !== null && $toStateId !== '') {
                throw new InvalidArgumentException('A negative decision must not carry a toStateId.');
            }

            if ($matchedTransitionId !== null && $matchedTransitionId !== '') {
                throw new InvalidArgumentException('A negative decision must not reference a matched transition.');
            }

            if ($reasons === []) {
                throw new InvalidArgumentException('A negative decision must carry at least one reason.');
            }
        }
    }

    /**
     * @param  list<string>  $reasons
     */
    public static function allow(
        string $toStateId,
        string $matchedTransitionId,
        ?int $slaMinutes = null,
        ?int $notifyBeforeMinutes = null,
        array $reasons = [],
    ): self {
        return new self(
            allowed: true,
            toStateId: $toStateId,
            matchedTransitionId: $matchedTransitionId,
            slaMinutes: $slaMinutes,
            notifyBeforeMinutes: $notifyBeforeMinutes,
            reasons: $reasons,
        );
    }

    /**
     * @param  list<string>  $reasons
     */
    public static function deny(array $reasons): self
    {
        return new self(
            allowed: false,
            toStateId: null,
            matchedTransitionId: null,
            slaMinutes: null,
            notifyBeforeMinutes: null,
            reasons: $reasons,
        );
    }
}
