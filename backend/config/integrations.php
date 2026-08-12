<?php

declare(strict_types=1);

$allowedHosts = array_values(array_filter(array_map(
    static fn (string $host): string => strtolower(trim($host)),
    explode(',', (string) env('CIP_INTEGRATION_PROBE_ALLOWED_HOSTS', '')),
)));

return [
    'probe' => [
        // Production should use an explicit host allow-list in addition to the
        // public-address SSRF checks. A leading "*." permits subdomains only.
        'allowed_hosts' => $allowedHosts,
        'require_allowlist' => (bool) env(
            'CIP_INTEGRATION_PROBE_REQUIRE_ALLOWLIST',
            env('APP_ENV') === 'production',
        ),
        'queue' => (string) env('CIP_INTEGRATION_PROBE_QUEUE', 'default'),
    ],
];
