<?php

declare(strict_types=1);

namespace App\Modules\Reports\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * GPS accuracy rule per docs/11 §12.
 *
 * Accepts accuracies from 0..100 metres inclusive. Anything above
 * 100m is a low-accuracy reading that should not be persisted —
 * the citizen's device should retry outdoors. Negative values are
 * rejected outright.
 */
class LocationAccuracy implements ValidationRule
{
    public const MAX_ACCURACY_METERS = 100.0;

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null) {
            return;
        }

        if (! is_numeric($value)) {
            $fail('GPS accuracy value is invalid. Please try again.');

            return;
        }

        $accuracy = (float) $value;

        if ($accuracy < 0.0) {
            $fail('GPS accuracy value is invalid. Please try again.');

            return;
        }

        if ($accuracy > self::MAX_ACCURACY_METERS) {
            $fail('GPS signal is too weak. Please move outdoors and try again.');
        }
    }
}
