<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('has the integrations table with expected columns', function (): void {
    expect(Schema::hasTable('integrations'))->toBeTrue();

    foreach (['id', 'code', 'provider', 'display_name', 'base_url', 'credentials', 'settings', 'status', 'last_check_at', 'last_error', 'created_at', 'updated_at', 'deleted_at'] as $col) {
        expect(Schema::hasColumn('integrations', $col))->toBeTrue("missing column $col");
    }
});
