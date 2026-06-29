<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('creates the report_internal_notes table with the expected columns', function (): void {
    expect(Schema::hasTable('report_internal_notes'))->toBeTrue();

    foreach (['id', 'report_id', 'department_id', 'author_id', 'body', 'created_at'] as $col) {
        expect(Schema::hasColumn('report_internal_notes', $col))->toBeTrue("missing column: {$col}");
    }
});

it('the migration is reversible (roundtrip)', function (): void {
    expect(Schema::hasTable('report_internal_notes'))->toBeTrue();
    \Illuminate\Support\Facades\Artisan::call('migrate:rollback', ['--step' => 1]);
    expect(Schema::hasTable('report_internal_notes'))->toBeFalse();
});
