<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Exceptions;

use App\Modules\Shared\Exceptions\ApiException;

/**
 * Thrown by the M6 workflow engine when the actor is
 * authenticated but lacks the role / permission required
 * by the transition row. Maps to `UNAUTHORIZED_TRANSITION`
 * / 403.
 */
class UnauthorizedTransitionException extends ApiException
{
    public static function missingRole(string $event, string $requiredRole): self
    {
        return new self(
            'UNAUTHORIZED_TRANSITION',
            "Transition '{$event}' requires the '{$requiredRole}' role.",
            403,
            ['event' => $event, 'required_role' => $requiredRole],
        );
    }

    public static function missingPermission(string $event, string $requiredPermission): self
    {
        return new self(
            'UNAUTHORIZED_TRANSITION',
            "Transition '{$event}' requires the '{$requiredPermission}' permission.",
            403,
            ['event' => $event, 'required_permission' => $requiredPermission],
        );
    }
}
