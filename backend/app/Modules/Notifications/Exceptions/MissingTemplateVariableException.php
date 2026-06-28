<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Exceptions;

use RuntimeException;

/**
 * Thrown when a template body references a placeholder
 * the caller did not provide in the variable map.
 *
 * Surfaced during `TemplateEngine::render()` so the
 * developer (not a citizen) sees the error at the call
 * site. The dispatcher treats this as a non-retryable
 * configuration error.
 */
final class MissingTemplateVariableException extends RuntimeException {}
