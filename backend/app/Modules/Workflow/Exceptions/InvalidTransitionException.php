<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Exceptions;

use App\Modules\Shared\Exceptions\ApiException;
use Throwable;

/**
 * Thrown by the M6 workflow engine when a (state, event)
 * pair has no matching transition, or when the only matching
 * transition(s) are blocked by conditions. Maps to
 * `INVALID_TRANSITION` / 422.
 */
class InvalidTransitionException extends ApiException
{
    public static function noTransition(string $fromStateCode, string $event): self
    {
        return new self(
            'INVALID_TRANSITION',
            "No transition for event '{$event}' from state '{$fromStateCode}'.",
            422,
            ['from_state' => $fromStateCode, 'event' => $event],
        );
    }

    public static function conditionsFailed(string $fromStateCode, string $event, ?Throwable $previous = null): self
    {
        return new self(
            'INVALID_TRANSITION',
            "The conditions for '{$event}' from state '{$fromStateCode}' were not met.",
            422,
            ['from_state' => $fromStateCode, 'event' => $event],
            $previous,
        );
    }
}
