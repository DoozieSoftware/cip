<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);


it('creates the workflow_definitions table with the expected columns', function (): void {
    expect(Schema::hasTable('workflow_definitions'))->toBeTrue();

    foreach ([
        'id', 'name', 'code', 'description', 'active',
        'created_at', 'updated_at', 'deleted_at',
    ] as $col) {
        expect(Schema::hasColumn('workflow_definitions', $col))->toBeTrue();
    }

    // code has a unique index.
    $indexes = collect(Schema::getIndexes('workflow_definitions'));
    $codeUnique = $indexes->first(fn ($i) => in_array('code', $i['columns'], true) && ($i['unique'] ?? false));
    expect($codeUnique)->not->toBeNull();
});
