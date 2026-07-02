<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
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
    // Target this migration by path rather than `--step 1`: migrations
    // are append-only, so later-added migrations (e.g. any migration
    // dated after 2026_06_29_110000) would otherwise be the one rolled
    // back instead of this one.
    Artisan::call('migrate:rollback', [
        '--path' => 'database/migrations/2026_06_29_110000_create_report_internal_notes_table.php',
        '--force' => true,
    ]);
    expect(Schema::hasTable('report_internal_notes'))->toBeFalse();
});
