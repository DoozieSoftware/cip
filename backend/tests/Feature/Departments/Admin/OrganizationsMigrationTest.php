<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('has the organizations table with expected columns', function (): void {
    expect(Schema::hasTable('organizations'))->toBeTrue();

    foreach (['id', 'code', 'name', 'legal_name', 'domain', 'contact', 'branding', 'storage_quota_mb', 'settings', 'active', 'created_at', 'updated_at', 'deleted_at'] as $col) {
        expect(Schema::hasColumn('organizations', $col))->toBeTrue("missing column $col");
    }
});
