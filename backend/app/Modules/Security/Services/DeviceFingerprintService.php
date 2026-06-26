<?php

declare(strict_types=1);

namespace App\Modules\Security\Services;

use App\Modules\Shared\Services\BaseService;
use Illuminate\Http\Request;

/**
 * Extracts a normalised device fingerprint from a request.
 *
 * Per docs/11 §10 (Device Fingerprinting). The returned array
 * contains the raw components as observed by the server; the hash
 * key (`hash`) is a stable SHA-256 over the concatenation of the
 * non-null components, suitable for correlation across requests
 * without storing the raw canvas/WebGL data.
 *
 * Client-supplied values are read from these headers when present:
 *  - X-Screen            (e.g. "1920x1080")
 *  - X-Timezone          (IANA tz, e.g. "Asia/Kolkata")
 *  - X-Language          (overrides Accept-Language for the first
 *                         preferred language; falls back to it)
 *  - X-Canvas-Fingerprint
 *  - X-WebGL-Fingerprint
 *
 * The user-agent and IP are taken from the standard Request API.
 * All methods tolerate missing fields — a request with none of the
 * optional headers will return an array whose only populated
 * component is `ip` (and possibly `user_agent`).
 *
 * The service is a stateless read-only helper; it has no side
 * effects and does not need its own tests beyond the unit coverage
 * in tests/Unit/Security/DeviceFingerprintServiceTest.php.
 */
class DeviceFingerprintService extends BaseService
{
    private const HASH_COMPONENTS = [
        'user_agent',
        'screen',
        'timezone',
        'language',
        'canvas',
        'webgl',
        'ip',
    ];

    /**
     * @return array{user_agent: ?string, screen: ?string, timezone: ?string, language: ?string, canvas: ?string, webgl: ?string, ip: ?string, hash: string}
     */
    public function fromRequest(Request $request): array
    {
        $components = [
            'user_agent' => $request->userAgent(),
            'screen' => $this->headerString($request, 'X-Screen'),
            'timezone' => $this->headerString($request, 'X-Timezone'),
            'language' => $this->resolveLanguage($request),
            'canvas' => $this->headerString($request, 'X-Canvas-Fingerprint'),
            'webgl' => $this->headerString($request, 'X-WebGL-Fingerprint'),
            'ip' => $request->ip(),
        ];

        $components['hash'] = $this->hash($components);

        return $components;
    }

    /**
     * @param  array{user_agent: ?string, screen: ?string, timezone: ?string, language: ?string, canvas: ?string, webgl: ?string, ip: ?string}  $components
     */
    public function hash(array $components): string
    {
        $parts = [];

        foreach (self::HASH_COMPONENTS as $key) {
            $value = $components[$key] ?? null;
            // Normalise empty strings to null so that "absent" and
            // "present-but-blank" do not produce different hashes.
            $parts[] = is_string($value) && $value !== '' ? $value : "\0";
        }

        return hash('sha256', implode('|', $parts));
    }

    private function headerString(Request $request, string $name): ?string
    {
        $value = $request->header($name);

        if ($value === null) {
            return null;
        }

        $value = is_array($value) ? ($value[0] ?? null) : $value;

        if ($value === null) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    private function resolveLanguage(Request $request): ?string
    {
        $explicit = $this->headerString($request, 'X-Language');

        if ($explicit !== null) {
            return $explicit;
        }

        $accept = $request->header('Accept-Language');

        if (is_array($accept)) {
            $accept = $accept[0] ?? null;
        }

        if (! is_string($accept) || $accept === '') {
            return null;
        }

        // Take only the first tag; strip quality and other params.
        $first = trim(explode(',', $accept, 2)[0]);
        $first = trim(explode(';', $first, 2)[0]);

        return $first === '' ? null : $first;
    }
}
