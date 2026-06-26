<?php

declare(strict_types=1);

namespace App\Modules\Media\Exceptions;

use App\Modules\Shared\Exceptions\ApiException;
use Throwable;

/**
 * Thrown by the M5 media pipeline whenever an uploaded file
 * fails one of the integrity / type gates (mime mismatch, magic
 * bytes mismatch, oversize, virus-scan verdict, etc.).
 *
 * Wraps an ApiException with a typed MEDIA_* error code so
 * callers and clients get a machine-readable code while
 * preserving the human-readable message.
 */
class InvalidMediaException extends ApiException
{
    public static function invalidMime(string $detected, string $expected, ?Throwable $previous = null): self
    {
        return new self(
            'MEDIA_INVALID_MIME',
            "Uploaded file mime '{$detected}' does not match expected '{$expected}'.",
            422,
            ['detected' => $detected, 'expected' => $expected],
            $previous,
        );
    }

    public static function invalidSignature(string $expected, ?Throwable $previous = null): self
    {
        return new self(
            'MEDIA_INVALID_SIGNATURE',
            "Uploaded file magic bytes do not match the expected '{$expected}' signature.",
            422,
            ['expected' => $expected],
            $previous,
        );
    }
}
