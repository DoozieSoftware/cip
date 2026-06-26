<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Services;

use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use App\Modules\Workflow\Exceptions\InvalidTransitionException;
use App\Modules\Workflow\Exceptions\UnauthorizedTransitionException;
use App\Modules\Workflow\Models\WorkflowTransition;

/**
 * Authorises an actor against a single transition row.
 *
 * The three checks, in order, are:
 *
 *  1. **Role**       — if the transition declares
 *                      `required_role` and the actor does
 *                      not have that Spatie role, throw
 *                      `UnauthorizedTransitionException`
 *                      (403 UNAUTHORIZED_TRANSITION).
 *  2. **Permission** — same, for `required_permission`.
 *  3. **Conditions** — delegate to `ConditionEvaluator`.
 *                      If the JSON `conditions` block
 *                      does not match the (Report, Actor)
 *                      context, throw the same exception
 *                      but with role/permission omitted.
 *
 * The check is intentionally *fail-closed*: an unknown role
 * or permission on the transition row is treated as a deny,
 * never as an allow.
 */
class TransitionGuard
{
    public function __construct(
        private readonly ConditionEvaluator $conditions,
    ) {}

    /**
     * @throws UnauthorizedTransitionException
     */
    public function ensure(WorkflowTransition $transition, User $actor, Report $report): void
    {
        if ($transition->required_role !== null && $transition->required_role !== '') {
            if (! $actor->hasRole($transition->required_role)) {
                throw UnauthorizedTransitionException::missingRole(
                    event: $transition->event,
                    requiredRole: $transition->required_role,
                );
            }
        }

        if ($transition->required_permission !== null && $transition->required_permission !== '') {
            if (! $actor->can($transition->required_permission)) {
                throw UnauthorizedTransitionException::missingPermission(
                    event: $transition->event,
                    requiredPermission: $transition->required_permission,
                );
            }
        }

        $conds = is_array($transition->conditions) ? $transition->conditions : [];

        if ($conds !== [] && ! $this->conditions->matches($conds, $report, $actor)) {
            // Permission/role already passed; only the
            // conditions failed. The actor is authenticated
            // and authorised, so this is a 422 (not 403).
            throw InvalidTransitionException::conditionsFailed(
                fromStateCode: (string) ($transition->fromState?->code ?? ''),
                event: $transition->event,
            );
        }
    }
}
