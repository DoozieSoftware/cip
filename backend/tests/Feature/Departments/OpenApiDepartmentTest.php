<?php

declare(strict_types=1);

/**
 * M11 OpenAPI contract test for the operations (department) surface.
 *
 * Mirrors the M9 / M10 OpenAPI tests. Per docs/05 §23 the
 * OpenAPI spec is the contract for every M-series surface.
 * This test asserts the operations paths, schemas, tags,
 * path parameters, and admin department sub-resources are
 * all present.
 */

it('exposes every M11 operations endpoint in the OpenAPI document', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->not->toBeFalse();

    foreach ([
        '/api/v1/department/dashboard:',
        '/api/v1/department/reports:',
        '/api/v1/department/reports/export:',
        '/api/v1/department/reports/{report}/accept:',
        '/api/v1/department/reports/{report}/start:',
        '/api/v1/department/reports/{report}/progress:',
        '/api/v1/department/reports/{report}/resolve:',
        '/api/v1/department/reports/{report}/close:',
        '/api/v1/department/reports/{report}/note:',
        '/api/v1/department/reports/{report}/notes:',
        '/api/v1/admin/departments/{department}/officers:',
        '/api/v1/admin/departments/{department}/officers/{user}:',
        '/api/v1/admin/departments/{department}/admin:',
    ] as $path) {
        expect($yaml)->toContain($path);
    }
});

it('declares a schema for every M11 operations resource', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    foreach ([
        'DepartmentDashboardCounts:',
        'DepartmentDashboardResponse:',
        'DepartmentReportListItem:',
        'DepartmentReportDetail:',
        'DepartmentReportListResponse:',
        'DepartmentReportDetailResponse:',
        'ProgressNoteRequest:',
        'InternalNote:',
        'InternalNoteRequest:',
        'InternalNoteResponse:',
        'InternalNoteListResponse:',
        'DepartmentOfficer:',
        'DepartmentOfficerListResponse:',
        'AttachOfficerRequest:',
        'AttachOfficerResponse:',
        'DetachOfficerResponse:',
        'UpdateDepartmentAdminRequest:',
        'UpdateDepartmentAdminResponse:',
    ] as $schema) {
        expect($yaml)->toContain($schema);
    }
});

it('tags every operations endpoint with the Operations tag', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('operationId: department.dashboard.show')
        ->and($yaml)->toContain('operationId: department.reports.index')
        ->and($yaml)->toContain('operationId: department.reports.export')
        ->and($yaml)->toContain('operationId: department.reports.accept')
        ->and($yaml)->toContain('operationId: department.reports.start')
        ->and($yaml)->toContain('operationId: department.reports.progress')
        ->and($yaml)->toContain('operationId: department.reports.resolve')
        ->and($yaml)->toContain('operationId: department.reports.close')
        ->and($yaml)->toContain('operationId: department.reports.note.store')
        ->and($yaml)->toContain('operationId: department.reports.notes.index')
        ->and($yaml)->toContain('operationId: admin.departments.officers.index')
        ->and($yaml)->toContain('operationId: admin.departments.officers.store')
        ->and($yaml)->toContain('operationId: admin.departments.officers.destroy')
        ->and($yaml)->toContain('operationId: admin.departments.admin.update');
});

it('lists Operations and Department Admin in the tags index', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('name: Operations')
        ->and($yaml)->toContain('name: \'Department Admin\'')
        ->and($yaml)->toContain('tags: [Operations]')
        ->and($yaml)->toContain("tags: ['Department Admin']");
});

it('declares path parameters for report and department ids', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('PathReportId:')
        ->and($yaml)->toContain('PathDepartmentId:');
});

it('exposes the export format enum on the export endpoint', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));

    expect($yaml)->toContain('enum: [csv, xlsx, pdf]');
});

it('the OpenAPI document is parseable as YAML', function (): void {
    $yaml = file_get_contents(storage_path('api-docs/openapi.yaml'));
    expect($yaml)->toStartWith('openapi: 3.0.0');
});
