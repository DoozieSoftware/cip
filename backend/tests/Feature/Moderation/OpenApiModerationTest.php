<?php

declare(strict_types=1);

/**
 * M10 OpenAPI contract test for the moderation surface.
 *
 * Mirrors the M9 OpenApiNotificationsTest. Per docs/05 §23 the
 * OpenAPI spec is the contract for every M-series surface — this
 * test asserts the moderation paths, schemas, tag, decision
 * enum, and standard error envelopes are all present.
 */

it('exposes every M10 moderation endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/moderator/queue:',
        '/api/v1/moderator/duplicates:',
        '/api/v1/moderator/fraud:',
        '/api/v1/moderator/reports/{id}:',
        '/api/v1/moderator/reports/{id}/review:',
        '/api/v1/moderator/reports/{id}/merge:',
        '/api/v1/moderator/reports/{id}/reject:',
        '/api/v1/moderator/reports/{id}/escalate:',
        '/api/v1/moderator/analytics/summary:',
        '/api/v1/moderator/analytics/ai-performance:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }
});

it('declares a schema for every M10 moderation resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'ReportListItem:',
        'ReportDetail:',
        'MediaItem:',
        'AuditEntry:',
        'StatusHistoryEntry:',
        'ReviewReportRequest:',
        'BulkMergeRequest:',
        'RejectRequest:',
        'EscalateRequest:',
        'AnalyticsSummary:',
        'AiPerformance:',
        'ReportQueueListResponse:',
        'ReportDetailResponse:',
        'AnalyticsSummaryResponse:',
        'AiPerformanceResponse:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('tags every moderation endpoint with the Moderation tag', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('tags: [Moderation]')
        ->and($yaml)->toContain('operationId: moderator.queue.index')
        ->and($yaml)->toContain('operationId: moderator.duplicates.index')
        ->and($yaml)->toContain('operationId: moderator.fraud.index')
        ->and($yaml)->toContain('operationId: moderator.reports.show')
        ->and($yaml)->toContain('operationId: moderator.reports.review')
        ->and($yaml)->toContain('operationId: moderator.reports.merge')
        ->and($yaml)->toContain('operationId: moderator.reports.reject')
        ->and($yaml)->toContain('operationId: moderator.reports.escalate')
        ->and($yaml)->toContain('operationId: moderator.analytics.summary')
        ->and($yaml)->toContain('operationId: moderator.analytics.ai_performance');
});

it('lists Moderation in the tags index', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('name: Moderation')
        ->and($yaml)->toContain('Moderator portal: queue, duplicate + fraud review, manual override, reassign, analytics, AI performance (M10).');
});

it('exposes the four-value decision enum on ReviewReportRequest', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('decision: { type: string, enum: [approve, reject, merge, escalate] }');
});

it('covers all 13 report_statuses in the ReportListItem status_code enum', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach (['draft', 'submitted', 'ai_processing', 'pending_moderator', 'assigned', 'accepted', 'in_progress', 'resolved', 'verified', 'closed', 'rejected', 'merged', 'escalated'] as $code) {
        expect($yaml)->toContain($code);
    }
});

it('declares the standard error envelopes on every M10 endpoint', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain("'401': { \$ref: '#/components/responses/Unauthorized' }")
        ->and($yaml)->toContain("'403': { \$ref: '#/components/responses/Forbidden' }")
        ->and($yaml)->toContain("'404': { \$ref: '#/components/responses/NotFound' }")
        ->and($yaml)->toContain("'422': { \$ref: '#/components/responses/ValidationError' }");
});

it('the OpenAPI document is parseable as YAML and uses OpenAPI 3', function (): void {
    $raw = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($raw)->toContain('openapi: 3.0.0');

    $spec = \Symfony\Component\Yaml\Yaml::parseFile(storage_path('api-docs/openapi.yaml'));
    expect($spec)->toBeArray();
    expect($spec['openapi'])->toStartWith('3.');
});
