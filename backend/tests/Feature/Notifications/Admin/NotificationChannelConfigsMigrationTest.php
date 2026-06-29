<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('has the notification_channel_configs table with expected columns', function (): void {
    expect(Schema::hasTable('notification_channel_configs'))->toBeTrue();

    foreach (['id', 'channel', 'code', 'display_name', 'credentials', 'retry_policy', 'settings', 'per_locale_defaults', 'active', 'created_at', 'updated_at', 'deleted_at'] as $col) {
        expect(Schema::hasColumn('notification_channel_configs', $col))->toBeTrue("missing column $col");
    }
});
