<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use Illuminate\Support\Facades\Log;

/**
 * Strips personally identifiable information from payloads
 * that are about to be sent to a third-party AI provider.
 *
 * Per docs/11 §28, the orchestrator must NEVER ship raw
 * citizen PII (mobile, email, address, exact lat/lng) to an
 * external model. The masker:
 *
 *  - removes `mobile`, `email`, `token`, `address`,
 *    `phone`, `password` keys at any depth
 *  - rounds `latitude` / `longitude` to 2 decimals
 *    (≈1.1 km grid, sufficient for civic routing,
 *    useless for personal tracking)
 *  - masks strings that look like 10-digit Indian mobile
 *    numbers (even when not under a known key) by
 *    replacing the middle 4 digits with ****
 *  - logs every mask event at info level (audit trail)
 *  - returns a NEW array — the input is never mutated
 */
class PiiMaskingService
{
    private const DROP_KEYS = [
        'mobile', 'email', 'token', 'address',
        'phone', 'password', 'citizen_id',
        'citizen_phone', 'citizen_email',
    ];

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function mask(array $payload): array
    {
        $before = $this->summarise($payload);
        $masked = $this->maskRecursive($payload);
        $after = $this->summarise($masked);

        Log::info('pii.masked', [
            'keys_before' => $before,
            'keys_after' => $after,
        ]);

        return $masked;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function maskRecursive(array $payload): array
    {
        $out = [];

        foreach ($payload as $k => $v) {
            $key = is_string($k) ? strtolower($k) : $k;

            if (is_string($key) && in_array($key, self::DROP_KEYS, true)) {
                continue;
            }

            if ($key === 'latitude' && (is_float($v) || is_int($v))) {
                $out[$k] = round((float) $v, 2);
                continue;
            }

            if ($key === 'longitude' && (is_float($v) || is_int($v))) {
                $out[$k] = round((float) $v, 2);
                continue;
            }

            if (is_array($v)) {
                $out[$k] = $this->maskRecursive($v);
                continue;
            }

            if (is_string($v)) {
                $out[$k] = $this->maskString($v);
                continue;
            }

            $out[$k] = $v;
        }

        return $out;
    }

    private function maskString(string $value): string
    {
        // 10-digit Indian mobile number (optionally with +91 or 0 prefix)
        $value = preg_replace(
            '/(?:\+?91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}/',
            '**********',
            $value,
        ) ?? $value;

        // Bare 10-digit number starting with 6-9
        $value = preg_replace(
            '/\b[6-9]\d{9}\b/',
            '**********',
            $value,
        ) ?? $value;

        return $value;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<int, string>
     */
    private function summarise(array $payload): array
    {
        $out = [];
        $this->collectKeys($payload, '', $out);

        return $out;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<int, string>  $out
     */
    private function collectKeys(array $payload, string $prefix, array &$out): void
    {
        foreach ($payload as $k => $v) {
            $key = is_string($k) ? $k : (string) $k;
            $path = $prefix === '' ? $key : $prefix.'.'.$key;
            $out[] = $path;

            if (is_array($v)) {
                $this->collectKeys($v, $path, $out);
            }
        }
    }
}
