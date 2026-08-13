<?php

declare(strict_types=1);

namespace App\Modules\Public\Services;

use App\Modules\Public\Models\ProductAnalyticsEvent;

class ProductAnalyticsService
{
    /**
     * Persist a bounded, allowlisted event without retaining account or
     * device identifiers. The endpoint is intentionally fire-and-forget from
     * the browser, so analytics failure never blocks a civic report.
     *
     * @param  array<string, mixed>  $properties
     */
    public function record(string $eventCode, array $properties = []): void
    {
        $safe = [];

        foreach ($properties as $key => $value) {
            if (! is_string($key) || preg_match('/(email|phone|token|password|name|address|lat|lng|location)/i', $key)) {
                continue;
            }

            if (is_string($value) && mb_strlen($value) <= 100) {
                $safe[$key] = $value;
            }
        }

        ProductAnalyticsEvent::query()->create([
            'event_code' => $eventCode,
            'properties' => $safe === [] ? null : $safe,
            'occurred_at' => now(),
        ]);
    }
}
