<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

it('ships a valid OpenAPI 3 spec covering the health endpoints', function (): void {
    $path = storage_path('api-docs/openapi.yaml');
    expect(file_exists($path))->toBeTrue();
    $spec = Yaml::parseFile($path);
    expect($spec)->toBeArray();
    expect($spec['openapi'])->toStartWith('3.');
    expect($spec['info']['title'])->toBe('Civic Intelligence Platform API');
    expect($spec['paths'])->toHaveKey('/api/v1/health');
    expect($spec['paths'])->toHaveKey('/api/v1/health/ready');
    expect($spec['paths']['/api/v1/health']['get']['tags'])->toContain('Health');
    expect($spec['paths']['/api/v1/health/ready']['get']['responses'])->toHaveKey('503');
});
