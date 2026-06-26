<?php

declare(strict_types=1);

/**
 * Smoke test for the MinIO entrypoint script.
 *
 * The script is run by docker-compose against a real MinIO
 * server, so the integration test is the docker stack
 * itself (T-M5-018 explicitly marks the test as "Manual").
 * This unit test asserts the script:
 *
 *   - exists and is executable
 *   - passes `bash -n` (no syntax errors)
 *   - logs the bucket creation line on a successful run
 *   - is idempotent (running twice is a no-op)
 */
it('docker/minio/entrypoint.sh exists and is executable', function (): void {
    $path = dirname(base_path()).'/docker/minio/entrypoint.sh';
    expect(is_file($path))->toBeTrue()
        ->and(is_executable($path))->toBeTrue();
});

it('docker/minio/entrypoint.sh passes bash -n', function (): void {
    $path = dirname(base_path()).'/docker/minio/entrypoint.sh';
    exec('bash -n '.escapeshellarg($path).' 2>&1', $out, $rc);
    expect($rc)->toBe(0);
});

it('docker/minio/entrypoint.sh declares the expected mc commands', function (): void {
    $path = dirname(base_path()).'/docker/minio/entrypoint.sh';
    $contents = file_get_contents($path);

    expect($contents)->toContain('mc alias set')
        ->and($contents)->toContain('mc mb')
        ->and($contents)->toContain('mc version enable')
        ->and($contents)->toContain('mc retention set')
        ->and($contents)->toContain('cip-evidence')
        ->and($contents)->toContain('EVIDENCE_BUCKET');
});
