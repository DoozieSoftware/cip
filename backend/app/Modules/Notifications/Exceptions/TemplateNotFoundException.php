<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Exceptions;

use RuntimeException;

/**
 * Thrown when no active notification template matches
 * the requested (code, locale) pair.
 *
 * The error is fatal to a single notification — the
 * dispatcher will mark the row `dead` and emit an
 * audit_log entry.
 */
final class TemplateNotFoundException extends RuntimeException {}
