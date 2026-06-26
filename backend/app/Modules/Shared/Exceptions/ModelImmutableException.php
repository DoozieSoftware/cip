<?php

declare(strict_types=1);

namespace App\Modules\Shared\Exceptions;

use RuntimeException;

/**
 * Thrown when code tries to mutate an immutable model (update or delete).
 *
 * Used by security-event rows (docs/11 §29) which are append-only.
 */
class ModelImmutableException extends RuntimeException
{
    public static function updateAttempted(string $model): self
    {
        return new self("{$model} is append-only; updates are not allowed.");
    }

    public static function deleteAttempted(string $model): self
    {
        return new self("{$model} is append-only; deletes are not allowed.");
    }
}
