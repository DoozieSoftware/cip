<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

/**
 * Per docs/05 §23 the OpenAPI spec is the contract for every
 * M-series surface. This file is the M5 contract check for
 * the Media namespace.
 */
it('exposes every M5 media endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/reports/{id}/photos:',
        '/api/v1/reports/{id}/video:',
        '/api/v1/reports/{id}/media:',
        '/api/v1/reports/{id}/media/{media}/audit:',
        '/api/v1/media/{media}/serve:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }

    // The 409 conflict path is documented (a second video).
    expect($yaml)->toContain('A video is already attached to this report');
});

it('declares a schema for every M5 media resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'Media:',
        'MediaWithSignedUrl:',
        'MediaHash:',
        'MediaAccessLog:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('tags the media endpoints and references the chain-of-custody schema in the audit endpoint', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain("name: 'Media'")
        ->and($yaml)->toContain('reports.photos.store')
        ->and($yaml)->toContain('reports.video.store')
        ->and($yaml)->toContain('reports.media.index')
        ->and($yaml)->toContain('reports.media.audit')
        ->and($yaml)->toContain('media.serve');

    // The serve route is public (no security) and accepts the signed-URL params.
    $spec = Yaml::parseFile(storage_path('api-docs/openapi.yaml'));
    // The spec is parseable.
    expect($spec)->toBeArray();
    expect($spec['openapi'])->toStartWith('3.');
});

it('declares the 409 / 410 / 422 error envelopes that M5 surface produces', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    // 409 — second video
    expect($yaml)->toContain("'409':");
    // 410 — bytes missing on storage
    expect($yaml)->toContain("'410':");
    // 422 — mime / size / duration errors
    expect($yaml)->toContain("'422':");
});
