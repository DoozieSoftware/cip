<?php

declare(strict_types=1);

namespace App\Modules\Shared\Exceptions;

use RuntimeException;
use Throwable;

class ApiException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $httpStatus = 400,
        public readonly array $details = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $httpStatus, $previous);
    }

    /**
     * @param  array<string, mixed>  $errors
     */
    public static function validation(string $message = 'Validation failed', array $errors = []): self
    {
        return new self('VALIDATION_FAILED', $message, 422, $errors);
    }

    public static function notFound(string $resource = 'Resource'): self
    {
        return new self('NOT_FOUND', "{$resource} not found", 404);
    }

    public static function unauthorized(string $message = 'Unauthorized'): self
    {
        return new self('UNAUTHORIZED', $message, 401);
    }

    public static function forbidden(string $message = 'Forbidden'): self
    {
        return new self('FORBIDDEN', $message, 403);
    }

    public static function rateLimited(string $message = 'Rate limited'): self
    {
        return new self('RATE_LIMITED', $message, 429);
    }

    public static function conflict(string $message = 'Conflict', string $code = 'CONFLICT'): self
    {
        return new self($code, $message, 409);
    }

    public static function serverError(string $message = 'Internal server error', ?Throwable $previous = null): self
    {
        return new self('INTERNAL_ERROR', $message, 500, [], $previous);
    }
}
