<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Services;

use App\Modules\Shared\Exceptions\ApiException;

/**
 * SSRF boundary for administrator-configured integration probes.
 *
 * Probes may only use HTTP(S), public DNS/IP targets and standard web ports.
 * DNS answers are checked before the HTTP client is invoked so hostnames that
 * resolve to loopback, private, link-local, metadata or other reserved ranges
 * cannot be used to reach internal services.
 */
class IntegrationUrlGuard
{
    /** @var list<int> */
    private const ALLOWED_PORTS = [80, 443];

    public function assertSafe(string $url): void
    {
        $parts = parse_url($url);
        $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
        $host = is_array($parts) && is_string($parts['host'] ?? null) ? trim($parts['host'], '[]') : '';
        $port = is_array($parts) && isset($parts['port']) ? (int) $parts['port'] : null;

        if (! is_array($parts)
            || ! in_array($scheme, ['http', 'https'], true)
            || $host === ''
            || isset($parts['user'], $parts['pass'])
            || ($port !== null && ! in_array($port, self::ALLOWED_PORTS, true))) {
            throw new ApiException('INTEGRATION_URL_UNSAFE', 'Integration probe URL is not allowed.', 422);
        }

        $addresses = $this->resolve($host);

        if ($addresses === [] && app()->environment('testing')) {
            // HTTP::fake() intentionally uses synthetic hosts. Production
            // always requires a DNS answer; this branch is test-only.
            return;
        }

        if ($addresses === []) {
            throw new ApiException('INTEGRATION_URL_UNSAFE', 'Integration probe host could not be resolved.', 422);
        }

        foreach ($addresses as $address) {
            if ($this->isBlockedAddress($address)) {
                throw new ApiException('INTEGRATION_URL_UNSAFE', 'Integration probe target resolves to a private or reserved address.', 422);
            }
        }
    }

    /** @return list<string> */
    private function resolve(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return [$host];
        }

        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        $addresses = [];

        if (is_array($records)) {
            foreach ($records as $record) {
                $address = $record['ip'] ?? $record['ipv6'] ?? null;

                if (is_string($address) && $address !== '') {
                    $addresses[] = $address;
                }
            }
        }

        return array_values(array_unique($addresses));
    }

    private function isBlockedAddress(string $address): bool
    {
        $address = strtolower(trim($address, '[]'));

        if (filter_var($address, FILTER_VALIDATE_IP) === false) {
            return true;
        }

        // NO_PRIV_RANGE + NO_RES_RANGE rejects RFC1918, loopback, link-local,
        // multicast, documentation and other IANA-reserved ranges for both
        // IPv4 and IPv6. Keep explicit metadata/unspecified checks readable.
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return true;
        }

        return $address === '0.0.0.0'
            || $address === '::'
            || $address === '::1'
            || str_starts_with($address, '169.254.')
            || str_starts_with($address, 'fe80:')
            || str_starts_with($address, 'fc')
            || str_starts_with($address, 'fd');
    }
}
