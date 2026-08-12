<?php

declare(strict_types=1);

/**
 * Validate the repository's time-bounded dependency exception register.
 * High and critical findings may not be waived by this file.
 */
$path = dirname(__DIR__, 2).'/.security/dependency-exceptions.json';

if (! is_file($path)) {
    fwrite(STDERR, "Dependency exception register is missing: {$path}\n");
    exit(1);
}

$payload = json_decode((string) file_get_contents($path), true);

if (! is_array($payload) || ! is_array($payload['exceptions'] ?? null)) {
    fwrite(STDERR, "Dependency exception register must contain an exceptions array.\n");
    exit(1);
}

$today = new DateTimeImmutable('today');
$seen = [];
$errors = [];

foreach ($payload['exceptions'] as $index => $exception) {
    $label = "exceptions[{$index}]";

    if (! is_array($exception)) {
        $errors[] = "{$label} must be an object.";
        continue;
    }

    foreach (['id', 'package', 'ecosystem', 'severity', 'expires_on', 'owner', 'reason'] as $field) {
        if (! is_string($exception[$field] ?? null) || trim($exception[$field]) === '') {
            $errors[] = "{$label}.{$field} must be a non-empty string.";
        }
    }

    $id = $exception['id'] ?? null;

    if (is_string($id) && isset($seen[$id])) {
        $errors[] = "Duplicate exception id {$id}.";
    }

    if (is_string($id)) {
        $seen[$id] = true;
    }

    if (in_array($exception['severity'] ?? null, ['high', 'critical'], true)) {
        $errors[] = "{$label} cannot waive high or critical findings.";
    }

    $expiresOn = $exception['expires_on'] ?? null;
    $expiry = is_string($expiresOn) ? DateTimeImmutable::createFromFormat('!Y-m-d', $expiresOn) : false;

    if (! $expiry || $expiry->format('Y-m-d') !== $expiresOn) {
        $errors[] = "{$label}.expires_on must use YYYY-MM-DD.";
    } elseif ($expiry < $today) {
        $errors[] = "{$label}.expires_on has expired ({$expiresOn}).";
    }
}

if ($errors !== []) {
    fwrite(STDERR, "Dependency exception validation failed:\n");

    foreach ($errors as $error) {
        fwrite(STDERR, " - {$error}\n");
    }
    exit(1);
}

fwrite(STDOUT, sprintf("Dependency exception register passed (%d active exception%s).\n", count($seen), count($seen) === 1 ? '' : 's'));
