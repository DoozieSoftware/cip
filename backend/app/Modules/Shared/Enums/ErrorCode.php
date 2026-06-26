<?php

declare(strict_types=1);

namespace App\Modules\Shared\Enums;

/**
 * Standardized error codes for the platform.
 *
 * Per docs/05 §23 — every error response carries a stable, machine-
 * readable `code` so clients can switch on it without parsing the
 * human-readable `message`. New error codes are added here so
 * ApiException call sites stay grep-able.
 *
 * The convention is SCREAMING_SNAKE_CASE. The first 3 characters
 * loosely group the source module:
 *   AUTH_  — authentication / authorization
 *   RPT_   — reports module
 *   GEO_   — geography
 *   IDEMPOTENCY_KEY_ — idempotency-key middleware
 *   VAL_   — generic validation
 *   NOT_   — generic not found
 *
 * Codes already used by ApiException's static factories are
 * included so the enum is the single source of truth.
 */
enum ErrorCode: string
{
    // Generic / shared
    case VALIDATION_FAILED = 'VALIDATION_FAILED';
    case NOT_FOUND = 'NOT_FOUND';
    case UNAUTHORIZED = 'UNAUTHORIZED';
    case FORBIDDEN = 'FORBIDDEN';
    case RATE_LIMITED = 'RATE_LIMITED';
    case CONFLICT = 'CONFLICT';
    case INTERNAL_ERROR = 'INTERNAL_ERROR';

    // Reports module
    case REPORT_NOT_FOUND = 'REPORT_NOT_FOUND';
    case INVALID_GPS = 'INVALID_GPS';
    case INVALID_GPS_LOW_ACCURACY = 'INVALID_GPS_LOW_ACCURACY';
    case IMPOSSIBLE_SPEED = 'IMPOSSIBLE_SPEED';
    case VIDEO_REQUIRED = 'VIDEO_REQUIRED';
    case PHOTO_REQUIRED = 'PHOTO_REQUIRED';
    case DUPLICATE_REPORT = 'DUPLICATE_REPORT';
    case INVALID_STATUS = 'INVALID_STATUS';
    case MISSING_REFERENCE_DATA = 'MISSING_REFERENCE_DATA';

    // Idempotency middleware
    case IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT';

    // Media module
    case MEDIA_INVALID_MIME = 'MEDIA_INVALID_MIME';
    case MEDIA_INVALID_SIGNATURE = 'MEDIA_INVALID_SIGNATURE';
    case VIDEO_ALREADY_PRESENT = 'VIDEO_ALREADY_PRESENT';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $c): string => $c->value, self::cases());
    }
}
