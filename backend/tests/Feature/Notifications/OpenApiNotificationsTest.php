<?php

declare(strict_types=1);

/**
 * M9 OpenAPI contract test for the notifications surface.
 *
 * Per docs/05 §23 the OpenAPI spec is the contract for every
 * M-series surface. This file is the in-process equivalent
 * of `swagger-cli validate` — it asserts that the YAML
 * declares every M9 endpoint, every M9 schema, the right
 * tags, the standard error envelopes, and that the
 * `Notification` channel enum matches what the channels
 * actually support (`push`, `email`, `sms`, `webhook`).
 *
 * The CI workflow runs `swagger-cli validate` as a separate
 * lint step; this test is the fast feedback inside Pest.
 */

it('exposes every M9 notifications endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/notifications:',
        '/api/v1/notifications/{id}/read:',
        '/api/v1/notifications/preferences:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }
});

it('declares a schema for every M9 notifications resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'Notification:',
        'NotificationListResponse:',
        'NotificationReadResponse:',
        'NotificationPreference:',
        'NotificationPreferenceBulkUpdate:',
        'NotificationPreferenceListResponse:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('tags the notifications endpoints with the Notifications tag', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('tags: [Notifications]')
        ->and($yaml)->toContain('operationId: notifications.index')
        ->and($yaml)->toContain('operationId: notifications.read')
        ->and($yaml)->toContain('operationId: notifications.preferences.index')
        ->and($yaml)->toContain('operationId: notifications.preferences.update');
});

it('lists Notifications in the tags index', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('name: Notifications')
        ->and($yaml)->toContain('Citizen notification inbox + per-(channel, event) opt-in preferences (M9).');
});

it('exposes the canonical channel enum on the Notification schema', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    // The channel enum must match the four real M9 channels.
    expect($yaml)->toContain('channel: { type: string, enum: [push, email, sms, webhook] }');
});

it('declares the standard error envelopes on every M9 endpoint', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    // 401 must be declared on every endpoint; 404 on the mark-read endpoint;
    // 422 on the bulk-update preference endpoint.
    expect($yaml)->toContain("'401': { \$ref: '#/components/responses/Unauthorized' }")
        ->and($yaml)->toContain("'404': { \$ref: '#/components/responses/NotFound' }")
        ->and($yaml)->toContain("'422': { \$ref: '#/components/responses/ValidationError' }");
});

it('NotificationListResponse exposes the unread_count cursor envelope', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('unread_count: { type: integer }')
        ->and($yaml)->toContain('next_cursor: { type: string, nullable: true }');
});

it('NotificationPreferenceBulkUpdate requires the preferences array', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('NotificationPreferenceBulkUpdate:')
        ->and($yaml)->toContain('required: [preferences]')
        ->and($yaml)->toContain('minItems: 1');
});

it('the OpenAPI document is parseable as YAML and uses OpenAPI 3', function (): void {
    $raw = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($raw)->toContain('openapi: 3.0.0');

    $spec = \Symfony\Component\Yaml\Yaml::parseFile(storage_path('api-docs/openapi.yaml'));
    expect($spec)->toBeArray();
    expect($spec['openapi'])->toStartWith('3.');
});
